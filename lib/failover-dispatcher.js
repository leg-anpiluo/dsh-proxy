/**
 * dsh-llm-proxy v2.0.0 — failover dispatcher.
 *
 * Extends the pure host routing of `RoutingDispatcher` with ONE guarded
 * failover step on the DIRECT path:
 *
 *   direct attempt fails at transport level BEFORE the response started
 *     → replay the request once through the failover proxy
 *     → fallback succeeded? remember the host for `negativeCacheTtlMs`
 *       so later requests skip the doomed direct attempt.
 *
 * Failover is never applied to:
 *   - hosts the router already sends through the proxy (they have no direct
 *     path to fall back from; if the proxy itself is down the error surfaces
 *     immediately instead of being retried against the same dead proxy),
 *   - loopback targets,
 *   - requests whose body cannot be replayed (streams),
 *   - targets equal to the failover proxy's own hostname,
 *   - anything, when `failoverEnabled` is false.
 *
 * The handler mirrors undici's official `RetryHandler` mechanics (stable
 * controller proxy re-pointed on every attempt, `headersSent` sentinel so
 * response events are only ever delivered downstream once, body-replay
 * guards) so it composes safely under `RetryAgent` and with `fetch`.
 *
 * The failover proxy is the SAME endpoint as the main proxy by default
 * (the user's Clash) — the point is not a second proxy, it is that a direct
 * connection that fails gets re-sent through the proxy the plugin already
 * manages. A dedicated `failoverProxy` URL (http(s) or socks5) overrides it.
 */

/** Transport-level failure codes eligible for failover (connection never established). */
const DIRECT_FAIL_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
  'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN', 'EHOSTDOWN',
  'ECONNRESET', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_DESTROYED',
])

/** Extract the transport error code from an error or its `cause` chain. */
function errorCodeOf(err) {
  let cur = err
  for (let depth = 0; cur != null && depth < 4; depth += 1) {
    if (typeof cur.code === 'string') return cur.code
    cur = cur.cause
  }
  return ''
}

/**
 * True when the dispatch body can be replayed on a second attempt.
 * Only value bodies are accepted: a stream/async iterable may have been
 * (partially) consumed by the failed direct attempt.
 */
function canReplayBody(body) {
  if (body === undefined || body === null) return true
  if (typeof body === 'string') return true
  if (typeof body === 'object') {
    if (Buffer.isBuffer(body) || body instanceof Uint8Array || Array.isArray(body)) return true
  }
  return false
}

/** True for user-initiated aborts — never fail over those. */
function isAbortError(err) {
  let cur = err
  for (let depth = 0; cur != null && depth < 4; depth += 1) {
    if (cur.name === 'AbortError' || cur.code === 'UND_ERR_ABORTED' || cur.code === 'ABORT_ERR') return true
    cur = cur.cause
  }
  return false
}

/**
 * Stable controller handed downstream for the lifetime of the request.
 * Mirrors undici RetryHandler's RetryController: each attempt runs on its own
 * connection controller, while the consumer's abort()/pause()/resume() must
 * always reach the currently active one.
 */
class StableController {
  constructor() {
    this.target = null
  }

  pause() { this.target?.pause() }
  resume() { this.target?.resume() }
  abort(reason) { this.target?.abort(reason) }

  get paused() { return this.target?.paused ?? false }
  get aborted() { return this.target?.aborted ?? false }
  get reason() { return this.target?.reason ?? null }
  get rawHeaders() { return this.target?.rawHeaders ?? null }
  set rawHeaders(value) { if (this.target) this.target.rawHeaders = value }
  get rawTrailers() { return this.target?.rawTrailers ?? null }
  set rawTrailers(value) { if (this.target) this.target.rawTrailers = value }
}

/**
 * Wraps the downstream handler for one direct-path request that may fail
 * over. The SAME instance is passed to both attempts (like RetryHandler):
 * response events reach downstream exactly once, guarded by `headersSent`.
 */
class FailoverHandler {
  /**
   * @param {object} input
   * @param {import('./failover-dispatcher.js').FailoverDispatcher} input.dispatcher owning dispatcher (negcache + logging)
   * @param {object} input.opts dispatch opts (body already replay-checked)
   * @param {object} input.handler downstream handler
   * @param {string} input.host target hostname
   */
  constructor({ dispatcher, opts, handler, host }) {
    this.dispatcher = dispatcher
    this.handler = handler
    this.opts = opts
    this.host = host
    this.controller = new StableController()
    this.headersSent = false
    this.failoverUsed = false
  }

  onRequestStart(controller, context) {
    // Keep the downstream abort/pause/resume surface on the active attempt.
    this.controller.target = controller
    if (!this.headersSent) this.handler.onRequestStart?.(this.controller, context)
  }

  onBodySent(chunk) {
    this.handler.onBodySent?.(chunk)
  }

  onRequestSent() {
    this.handler.onRequestSent?.()
  }

  onRequestUpgrade(controller, statusCode, headers, socket) {
    this.headersSent = true
    this.dispatcher.negClear(this.host)
    this.handler.onRequestUpgrade?.(this.controller, statusCode, headers, socket)
  }

  onResponseStart(controller, statusCode, headers, statusMessage) {
    this.headersSent = true
    if (this.failoverUsed) {
      // The direct path failed, the proxy path works: cache the host so the
      // TTL window skips direct entirely.
      this.dispatcher.negMark(this.host)
    } else {
      // Direct is healthy again (or was never the problem).
      this.dispatcher.negClear(this.host)
    }
    this.handler.onResponseStart?.(this.controller, statusCode, headers, statusMessage)
  }

  onResponseData(controller, chunk) {
    this.handler.onResponseData?.(this.controller, chunk)
  }

  onResponseEnd(controller, trailers) {
    this.handler.onResponseEnd?.(this.controller, trailers)
  }

  onResponseError(controller, err) {
    if (!this.failoverUsed && this.#failoverEligible(controller, err)) {
      this.failoverUsed = true
      try {
        const accepted = this.dispatcher.dispatchFallback(this.opts, this, this.host, err)
        if (accepted !== false) return
        // Fallback refused the request synchronously — fall through.
      } catch {
        // Synchronous dispatch failure — fall through to the original error.
      }
    }
    // Failover already used, ineligible error, or fallback dispatch threw:
    // propagate. For a failed fallback attempt this is the proxy-path error
    // (more relevant); otherwise the direct-path error.
    this.handler.onResponseError?.(this.controller, err)
  }

  /** Transport-level failure before any response bytes: failover may proceed. */
  #failoverEligible(controller, err) {
    if (this.dispatcher.closed) return false
    if (controller?.aborted) return false
    if (isAbortError(err)) return false
    return DIRECT_FAIL_CODES.has(errorCodeOf(err))
  }
}

/** Normalize a failover proxy endpoint string into a comparable hostname. */
function endpointHost(endpoint) {
  try {
    return new URL(endpoint).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export class FailoverDispatcher {
  /**
   * @param {object} opts
   * @param {object} opts.undici undici module (Agent / ProxyAgent / Socks5ProxyAgent)
   * @param {import('./routing-dispatcher.js').RoutingDispatcher} opts.router the host router (owns direct + main proxy agents)
   * @param {boolean} [opts.failoverEnabled] master switch (default true)
   * @param {string} [opts.failoverProxy] failover endpoint URL; '' reuses the router's main proxy
   * @param {number} [opts.negativeCacheTtlMs] how long a failed-direct host skips direct (default 60000, 0 disables)
   * @param {object} [opts.logger] cordis logger
   */
  constructor({ undici, router, failoverEnabled = true, failoverProxy = '', negativeCacheTtlMs = 60000, logger }) {
    this.undici = undici
    this.router = router
    this.logger = logger
    this.failoverEnabled = failoverEnabled === true
    this.negativeCacheTtlMs = Number.isFinite(negativeCacheTtlMs) ? Math.max(0, negativeCacheTtlMs) : 60000
    this.isMockActive = false
    this.closed = false

    // The router's main proxy agent doubles as the failover agent by default:
    // the same Clash instance that serves the selected models answers the
    // fallback of everything else.
    const override = typeof failoverProxy === 'string' ? failoverProxy.trim() : ''
    if (override === '') {
      this.fallbackEndpoint = ''
      this.fallback = router.proxy
      this.fallbackKind = this.fallback !== null ? 'main-proxy' : 'none'
    } else {
      this.fallbackEndpoint = override
      this.fallbackHost = endpointHost(override)
      try {
        const protocol = new URL(override).protocol
        if (protocol === 'socks5:' || protocol === 'socks:') {
          if (typeof undici.Socks5ProxyAgent !== 'function') {
            throw new Error('this undici build does not export Socks5ProxyAgent')
          }
          this.fallback = new undici.Socks5ProxyAgent(override)
          this.fallbackKind = 'socks5'
        } else if (protocol === 'http:' || protocol === 'https:') {
          // Same keep-alive pitfall as the main proxy: disable reuse on the
          // proxy-side pool so a silently closed tunnel cannot pin requests.
          this.fallback = new undici.ProxyAgent({
            uri: override,
            clientFactory: (origin, poolOpts) => new undici.Pool(origin, { ...poolOpts, pipelining: 0 }),
          })
          this.fallbackKind = 'http'
        } else {
          throw new Error(`unsupported failover proxy protocol "${protocol}" (use http://, https:// or socks5://)`)
        }
      } catch (error) {
        logger?.warn(`dsh-llm-proxy: invalid failoverProxy "${override}" — direct failover disabled`)
        logger?.warn(error)
        this.fallback = null
        this.fallbackKind = 'none'
      }
    }

    // Hostnames that must never fail over: the failover proxy itself (and the
    // main proxy — a request TO the proxy that failed direct must not be
    // tunnelled through the same proxy).
    this.#noFailoverHosts = new Set()
    if (this.fallbackHost) this.#noFailoverHosts.add(this.fallbackHost)
    if (router.proxyEndpointHost) this.#noFailoverHosts.add(router.proxyEndpointHost)

    /** @type {Map<string, number>} host → epoch ms until which direct is skipped */
    this.#negCache = new Map()
  }

  /** @type {Set<string>} */
  #noFailoverHosts

  /** @type {Map<string, number>} */
  #negCache

  /**
   * undici dispatcher entry point. Routes through the router, then wraps the
   * DIRECT path with the failover handler when the request qualifies.
   */
  dispatch(opts, handler) {
    if (this.closed) {
      handler?.onResponseError?.(null, new Error('dsh-llm-proxy: dispatcher closed'))
      return false
    }
    const { host, agent } = this.router.routeOf(opts.origin)
    if (!this.#failoverApplies(host, agent)) return agent.dispatch(opts, handler)
    if (!canReplayBody(opts.body)) return agent.dispatch(opts, handler)

    if (this.#negHit(host)) {
      this.logger?.debug?.(`dsh-llm-proxy: failover cache hit — ${host} skips direct this TTL window`)
      return this.fallback.dispatch(opts, handler)
    }
    return agent.dispatch(opts, new FailoverHandler({ dispatcher: this, opts, handler, host }))
  }

  /** Should this host/agent pair get the failover wrapper? */
  #failoverApplies(host, agent) {
    if (!this.failoverEnabled || this.fallback === null) return false
    // Proxied-model hosts have no direct path to fall back from.
    if (agent !== this.router.direct) return false
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    if (host && this.#noFailoverHosts.has(host)) return false
    return true
  }

  /** Re-dispatch one attempt through the fallback agent. */
  #dispatchFallback(opts, handler, host, directError) {
    this.logger?.info?.(
      `dsh-llm-proxy: direct → ${host} failed (${errorCodeOf(directError) || directError?.name || 'error'}) — retrying via ${this.fallbackKind} failover proxy`,
    )
    return this.fallback.dispatch(opts, handler)
  }

  #negHit(host) {
    const until = this.#negCache.get(host)
    if (until === undefined) return false
    if (until <= Date.now()) {
      this.#negCache.delete(host)
      return false
    }
    return true
  }

  /** Remember a host whose proxy fallback just worked (TTL window). */
  negMark(host) {
    if (this.negativeCacheTtlMs <= 0 || !host) return
    this.#negCache.set(host, Date.now() + this.negativeCacheTtlMs)
  }

  /** Direct reached the host — drop any stale failover-cache entry. */
  negClear(host) {
    this.#negCache.delete(host)
  }

  /** Snapshot of hosts currently cached as direct-broken (for tests / logs). */
  negCacheEntries() {
    const now = Date.now()
    const rows = []
    for (const [host, until] of this.#negCache) {
      if (until <= now) this.#negCache.delete(host)
      else rows.push({ host, remainingMs: until - now })
    }
    return rows
  }

  /** Re-dispatch one attempt through the fallback agent. */
  dispatchFallback(opts, handler, host, directError) {
    this.logger?.info?.(
      `dsh-llm-proxy: direct → ${host} failed (${errorCodeOf(directError) || directError?.name || 'error'}) — retrying via ${this.fallbackKind} failover proxy`,
    )
    return this.fallback.dispatch(opts, handler)
  }

  close(callback) {
    this.closed = true
    const jobs = [this.router.close()]
    if (this.fallback !== null && this.fallback !== this.router.proxy) jobs.push(this.fallback.close())
    if (typeof callback === 'function') {
      Promise.all(jobs).then(() => callback(null), callback)
      return
    }
    return Promise.all(jobs)
  }

  destroy(err, callback) {
    this.closed = true
    const jobs = [this.router.destroy(err)]
    if (this.fallback !== null && this.fallback !== this.router.proxy) jobs.push(this.fallback.destroy(err))
    if (typeof callback === 'function') {
      Promise.all(jobs).then(() => callback(null), callback)
      return
    }
    return Promise.all(jobs)
  }
}

export { canReplayBody, errorCodeOf, isAbortError }
