/**
 * dsh-proxy — routing dispatcher.
 *
 * Routes each request by target hostname:
 *
 *   1. loopback hosts (localhost/127.0.0.1/::1)        → direct Agent
 *   2. hosts matching the proxied-model host set       → ProxyAgent
 *   3. everything else                                 → direct Agent
 *
 * The default is DIRECT: only hosts whose models were explicitly selected as
 * "走代理的模型" go through the proxy. This mirrors the model-level intent —
 * pick the models that need the proxy, everything else stays on the direct
 * path (domestic APIs etc.).
 *
 * Retry is NOT implemented here: the plugin wraps this dispatcher in undici's
 * official `RetryAgent` (lib/index.js), which replays the request on transport
 * errors, HTTP 429 and 5xx with proper body/connection handling. This class
 * stays a pure router (route + agent selection).
 *
 * The class only needs to implement the subset of the undici Dispatcher
 * contract that `fetch` uses (`dispatch`, `close`, `destroy`, `isMockActive`),
 * so it can be installed with `setGlobalDispatcher` just like the built-in
 * agents.
 */

/**
 * Normalize a configured proxy endpoint into `{ uri, host, port }`.
 *
 * `proxyHost` may be a bare hostname/IP (the common case), a scheme-less
 * `host:port` pair, or a full proxy URL (`http://127.0.0.1:7897`,
 * `socks5://host`): a deployment that pastes an endpoint copied from its proxy
 * client should not have to split it by hand, and silently building
 * `http://http://host:7897` would break every proxied request. The scheme and
 * an embedded port are therefore adopted when present, while a bare host keeps
 * the caller's port.
 *
 * All three shapes go through `URL`: only the scheme branch used to, so a
 * scheme-less `10.0.0.9:1080` kept its port inside the host and produced
 * `http://10.0.0.9:1080:7897` — a double port, i.e. a dead proxy for exactly
 * the copy-paste case this helper exists for. Bracketed IPv6 (`[::1]:1080`) is
 * split by the same parse.
 * @param proxyHost - configured host, `host:port`, or full URL.
 * @param proxyPort - configured port (used when the value carries none).
 * @returns the normalized endpoint.
 */
export function normalizeProxyEndpoint(proxyHost, proxyPort) {
  let host = String(proxyHost ?? '').trim()
  let scheme = 'http'
  const explicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(host)
  try {
    // A URL with an embedded port wins; otherwise the caller's port stands.
    const url = new URL(explicitScheme ? host : `http://${host}`)
    if (explicitScheme) scheme = url.protocol.replace(/:$/, '') || 'http'
    if (url.hostname) host = url.hostname
    if (url.port) proxyPort = Number(url.port)
  } catch {
    /* keep the raw host; the agent's own URL check surfaces the error */
  }
  return { uri: `${scheme}://${host}:${proxyPort}`, host, port: proxyPort }
}

/** Normalize a hostname for matching (strip port, brackets, scheme). */
function normalizeHost(host) {
  if (!host) return ''
  let h = String(host).trim().toLowerCase()
  if (h.includes('://')) {
    try {
      h = new URL(h).hostname
    } catch {
      /* fall through */
    }
  }
  h = h.replace(/:\d+$/, '').replace(/^\[(.+)\]$/, '$1')
  return h
}

/** True when `host` is a loopback address (always direct, never proxied). */
function isLoopback(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

export class RoutingDispatcher {
  /**
   * @param {object} opts
   * @param {object} opts.undici            undici module (for Agent / ProxyAgent)
   * @param {string} [opts.proxyHost]       proxy hostname/IP (default 127.0.0.1)
   * @param {number} [opts.proxyPort]       proxy port (default 7897)
   * @param {string[]|Set<string>} [opts.proxyHosts]  hostnames that go through the proxy
   * @param {object} [opts.directDispatcher] dispatcher to reuse for the DIRECT path
   *   instead of a private Agent — the global dispatcher this plugin replaced
   *   (dsh ≥ 0.1.3 installs `@deepseek-ai/dsh-http-proxy` as the global
   *   dispatcher at profile boot, so chaining keeps the deployment's own
   *   outbound-proxy policy intact for direct traffic). Borrowed: never
   *   closed/destroyed by this instance.
   * @param {object} [opts.logger]          cordis logger (info/warn/error)
   */
  constructor({ undici, proxyHost = '127.0.0.1', proxyPort = 7897, proxyHosts = [], directDispatcher = null, logger }) {
    this.undici = undici
    this.logger = logger
    this.isMockActive = false
    this.proxyHost = proxyHost
    this.proxyPort = proxyPort

    // Direct path for loopback + unselected hosts. A borrowed dispatcher (the
    // deployment's own — e.g. dsh-http-proxy's env policy agent) is chained
    // instead of shadowed by a private Agent, so the host's outbound policy
    // still governs every host this plugin keeps direct.
    this.directOwned = directDispatcher === null || directDispatcher === undefined
    this.direct = this.directOwned ? new undici.Agent() : directDispatcher

    // One ProxyAgent for the configured proxy endpoint.
    //
    // Connection-pool pitfall (undici 8.x): the ProxyAgent's internal
    // proxy-side client pool defaults to keep-alive. When the proxy (e.g.
    // Clash) silently closes an idle CONNECT tunnel, undici does not notice
    // and reuses the dead socket — the request hangs until timeout
    // ("Request timed out" / HeadersTimeoutError). Empirically this fails
    // intermittently (measured 2/10 with 2.5s idle gaps while a raw tunnel
    // succeeds 10/10). The fix disables reuse on the proxy-side pool via
    // clientFactory + pipelining: 0, so every tunnel is a fresh connection.
    const endpoint = normalizeProxyEndpoint(proxyHost, proxyPort)
    this.proxyEndpoint = endpoint.uri
    this.proxyHost = endpoint.host
    this.proxyPort = endpoint.port
    let proxyUrl = ''
    try {
      proxyUrl = endpoint.uri
      const protocol = new URL(proxyUrl).protocol
      if (protocol === 'socks5:' || protocol === 'socks:') {
        // undici's ProxyAgent only speaks HTTP CONNECT, and it *accepts* a
        // socks5 URL at construction — so a socks5 `proxyHost` used to install
        // an agent that failed on every request instead of failing here. The
        // failover path (failover-dispatcher.js) already routes socks5 to
        // Socks5ProxyAgent; the main path now matches it.
        if (typeof undici.Socks5ProxyAgent !== 'function') {
          throw new Error('this undici build does not export Socks5ProxyAgent')
        }
        this.proxy = new undici.Socks5ProxyAgent(proxyUrl)
      } else {
        this.proxy = new undici.ProxyAgent({
          uri: proxyUrl,
          clientFactory: (origin, opts) => new undici.Pool(origin, { ...opts, pipelining: 0 }),
        })
      }
    } catch (error) {
      logger?.warn(`dsh-proxy: invalid proxy endpoint "${proxyUrl}" — proxy routing disabled`)
      logger?.warn(error)
      this.proxy = null
    }

    // Hostnames selected via the 走代理的模型 list.
    this.proxyHosts = new Set()
    for (const host of proxyHosts ?? []) {
      const key = normalizeHost(host)
      if (key && !isLoopback(key)) this.proxyHosts.add(key)
    }

    this.closed = false
  }

  /**
   * @returns {import('undici').ProxyAgent|import('undici').Agent} the agent for a hostname
   */
  #agentFor(host) {
    if (this.proxy === null) return this.direct
    if (isLoopback(host)) return this.direct
    if (host && this.proxyHosts.has(host)) return this.proxy
    // Subdomain fallback: a route entry that the host ends with.
    for (const entry of this.proxyHosts) {
      if (host.endsWith(`.${entry}`)) return this.proxy
    }
    return this.direct
  }

  /**
   * Resolve the dispatch target for an origin URL. Exposed so the
   * FailoverDispatcher (v2) can reuse the exact routing decision while
   * wrapping the direct path with proxy failover.
   *
   * @param {string|URL|undefined} origin - request origin (opts.origin).
   * @returns {{ host: string, agent: import('undici').ProxyAgent|import('undici').Agent }}
   */
  routeOf(origin) {
    let host = ''
    try {
      host = normalizeHost(new URL(origin).hostname)
    } catch {
      host = normalizeHost(String(origin ?? ''))
    }
    return { host, agent: this.#agentFor(host) }
  }

  /** Normalized hostname of the configured main proxy endpoint ('' when unset). */
  get proxyEndpointHost() {
    return normalizeHost(`http://${this.proxyHost}:${this.proxyPort}`)
  }

  /**
   * undici dispatcher entry point. Returns true when the request is
   * accepted; false means the caller owns the failure.
   */
  dispatch(opts, handler) {
    if (this.closed) {
      handler?.onResponseError?.(null, new Error('dsh-proxy: dispatcher closed'))
      return false
    }
    return this.routeOf(opts.origin).agent.dispatch(opts, handler)
  }

  close(callback) {
    this.closed = true
    // A borrowed direct dispatcher belongs to the deployment (dsh-http-proxy's
    // env policy agent, or whatever global dispatcher this plugin replaced):
    // closing it would tear down the host's own transport while it is still
    // installed. Only a private Agent is ours to close.
    const jobs = this.directOwned ? [this.direct.close()] : []
    if (this.proxy !== null) jobs.push(this.proxy.close())
    if (typeof callback === 'function') {
      Promise.all(jobs).then(() => callback(null), callback)
      return
    }
    return Promise.all(jobs)
  }

  destroy(err, callback) {
    this.closed = true
    const jobs = this.directOwned ? [this.direct.destroy(err)] : []
    if (this.proxy !== null) jobs.push(this.proxy.destroy(err))
    if (typeof callback === 'function') {
      Promise.all(jobs).then(() => callback(null), callback)
      return
    }
    return Promise.all(jobs)
  }
}
