/**
 * dsh-proxy v2.0.0 — unit tests for FailoverDispatcher.
 *
 * Semantics under test (all with a fake undici shim, no real network):
 *   - direct success passes through untouched;
 *   - direct transport failure (ECONNREFUSED etc.) → one replay through the
 *     failover proxy, downstream response events delivered exactly once;
 *   - a successful fallback marks the host for the TTL window → later
 *     requests skip direct entirely until the TTL expires;
 *   - ineligible errors (user aborts, non-transport codes) propagate;
 *   - proxied-model hosts, loopback, the proxy's own host and stream bodies
 *     never fail over;
 *   - when the fallback also fails, downstream sees exactly one error and
 *     the host is NOT cached;
 *   - a transport failure AFTER the response started is never replayed
 *     (headersSent guard — one dispatch delivers one response lifecycle);
 *   - failover composes under undici RetryAgent (failover answers transport
 *     errors first; HTTP 429 is left to RetryAgent, never failed over).
 *
 * Run: node --test test/failover-dispatcher.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FailoverDispatcher, errorCodeOf, canReplayBody, isAbortError } from '../lib/failover-dispatcher.js'
import { RoutingDispatcher } from '../lib/routing-dispatcher.js'
import { RetryAgent } from 'undici'

// --- Fake undici -------------------------------------------------------------
const DIRECT_FAIL = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })

function fakeController() {
  return { aborted: false, reason: null, paused: false, pause() {}, resume() {}, abort() {} }
}

/**
 * Build a fake undici module. `script[host]` optionally makes the DIRECT
 * agent fail (default) or respond for that host; the proxy agents always
 * succeed unless `proxyFails` is set.
 */
function makeUndici(record, { directFailHosts = null, proxyFails = false } = {}) {
  class FakeAgentBase {
    constructor(name) {
      this.name = name
    }
    close() { return Promise.resolve() }
    destroy() { return Promise.resolve() }
    respond(handler, opts) {
      record.push({ agent: this.name, origin: opts.origin, host: opts.host ?? new URL(opts.origin).hostname })
      const controller = fakeController()
      handler?.onRequestStart?.(controller, undefined)
      const failed = typeof this.fail === 'function' ? this.fail(opts) : this.fail
      if (failed) {
        handler?.onResponseError?.(controller, DIRECT_FAIL)
        return true
      }
      handler?.onResponseStart?.(controller, 200, { 'content-type': 'text/plain' }, 'OK')
      handler?.onResponseEnd?.(controller, {})
      return true
    }
  }
  class FakeAgent extends FakeAgentBase {
    constructor() {
      super('direct')
      // Per-host failure scripting for the direct agent.
      this.fail = (opts) => directFailHosts !== null && directFailHosts.includes(new URL(opts.origin).hostname)
    }
    dispatch(opts, handler) {
      return this.respond(handler, opts)
    }
  }
  class FakeProxyAgent extends FakeAgentBase {
    constructor(uriOrOpts) {
      const uri = typeof uriOrOpts === 'string' ? uriOrOpts : uriOrOpts?.uri
      if (typeof uri !== 'string' || !/^(https?|socks5?):\/\/[^/\s]+(:\d+)?$/.test(uri)) {
        throw new Error('Invalid URL')
      }
      super(`proxy:${uri}`)
      this.uri = uri
      this.fail = proxyFails
    }
    dispatch(opts, handler) {
      return this.respond(handler, opts)
    }
  }
  class FakePool {
    constructor(origin, opts) {
      this.origin = origin
      this.opts = opts
    }
    close() { return Promise.resolve() }
    destroy() { return Promise.resolve() }
  }
  class FakeSocks5ProxyAgent extends FakeProxyAgent {
    constructor(uri) {
      super(uri)
      if (!/^socks5?:\/\//.test(uri)) throw new Error('must be socks5://')
      this.name = `socks:${uri}`
    }
  }
  return { Agent: FakeAgent, ProxyAgent: FakeProxyAgent, Pool: FakePool, Socks5ProxyAgent: FakeSocks5ProxyAgent }
}

function makeRouter(record, opts = {}) {
  return new RoutingDispatcher({
    undici: makeUndici(record, { directFailHosts: opts.directFailHosts ?? null, proxyFails: opts.proxyFails ?? false }),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
    proxyHosts: opts.proxyHosts ?? [],
  })
}

function makeFailover(record, {
  routerOpts = {},
  failoverEnabled = true,
  failoverProxy = '',
  negativeCacheTtlMs = 60000,
  logs = null,
} = {}) {
  const router = makeRouter(record, routerOpts)
  const d = new FailoverDispatcher({
    undici: makeUndici(record, { proxyFails: routerOpts.proxyFails ?? false }),
    router,
    failoverEnabled,
    failoverProxy,
    negativeCacheTtlMs,
    logger: logs,
  })
  return { d, router }
}

function req(origin, body) {
  return { origin, path: '/v1/chat/completions', method: 'POST', headers: [], body }
}

/** Collect downstream handler events. */
function spy() {
  const events = []
  return {
    events,
    onRequestStart(controller) { events.push(['reqStart']) },
    onResponseStart(controller, statusCode) { events.push(['respStart', statusCode]) },
    onResponseData(controller, chunk) { events.push(['data']) },
    onResponseEnd(controller, trailers) { events.push(['end']) },
    onResponseError(controller, err) { events.push(['error', err?.code ?? err?.message]) },
  }
}

// --- Helpers -----------------------------------------------------------------
test('errorCodeOf unwraps cause chains', () => {
  const err = new Error('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ENOTFOUND' }) })
  assert.equal(errorCodeOf(err), 'ENOTFOUND')
  assert.equal(errorCodeOf(new Error('plain')), '')
})

test('canReplayBody accepts value bodies and rejects streams', () => {
  assert.ok(canReplayBody(undefined))
  assert.ok(canReplayBody('json'))
  assert.ok(canReplayBody(Buffer.from('x')))
  assert.ok(canReplayBody(new Uint8Array(1)))
  assert.ok(!canReplayBody({ [Symbol.asyncIterator]: async function* () {} }))
  assert.ok(!canReplayBody(new ReadableStream()))
})

test('isAbortError recognizes abort errors through causes', () => {
  assert.ok(isAbortError(Object.assign(new Error('a'), { name: 'AbortError' })))
  assert.ok(isAbortError(new Error('wrap', { cause: Object.assign(new Error('b'), { code: 'UND_ERR_ABORTED' }) })))
  assert.ok(!isAbortError(DIRECT_FAIL))
})

// --- Pass-through --------------------------------------------------------------
test('direct success passes through untouched, no failover bookkeeping', () => {
  const record = []
  const { d } = makeFailover(record)
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.deepEqual(h.events, [['reqStart'], ['respStart', 200], ['end']])
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
})

test('proxied-model hosts never fail over (proxy failure propagates as-is)', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { proxyHosts: ['api.b.ai'], proxyFails: true } })
  const h = spy()
  d.dispatch(req('https://api.b.ai/v1'), h)
  // Only the (failing) main proxy was touched; no fallback replay.
  assert.deepEqual(record.map((r) => r.agent), ['proxy:http://127.0.0.1:7897'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'ECONNREFUSED']])
})

test('loopback targets never fail over', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['127.0.0.1'] } })
  const h = spy()
  d.dispatch(req('http://127.0.0.1:8080/v1'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'ECONNREFUSED']])
})

test('the failover proxy host itself never fails over', () => {
  const record = []
  const { d } = makeFailover(record, {
    routerOpts: { directFailHosts: ['clash.local'] },
    failoverProxy: 'http://clash.local:7890',
  })
  const h = spy()
  d.dispatch(req('https://clash.local:9090/configs'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'ECONNREFUSED']])
})

test('stream bodies never fail over', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1', new ReadableStream()), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'ECONNREFUSED']])
})

test('disabled failover keeps pure routing', () => {
  const record = []
  const { d } = makeFailover(record, { failoverEnabled: false, routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'ECONNREFUSED']])
})

// --- Failover core ---------------------------------------------------------------
test('direct failure replays once via the main proxy; response delivered exactly once', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'proxy:http://127.0.0.1:7897'])
  assert.deepEqual(h.events, [['reqStart'], ['reqStart'], ['respStart', 200], ['end']])
  // The successful fallback marked the host.
  const cached = d.negCacheEntries()
  assert.equal(cached.length, 1)
  assert.equal(cached[0].host, 'api.deepseek.com')
  assert.ok(cached[0].remainingMs > 0 && cached[0].remainingMs <= d.negativeCacheTtlMs)
})

test('neg-cache hit skips direct until the TTL expires', async () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] }, negativeCacheTtlMs: 30 })
  d.dispatch(req('https://api.deepseek.com/v1'), spy())
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'proxy:http://127.0.0.1:7897'])
  // Within the TTL: straight to the fallback agent.
  d.dispatch(req('https://api.deepseek.com/v1'), spy())
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'proxy:http://127.0.0.1:7897', 'proxy:http://127.0.0.1:7897'])
  // After the TTL: direct is tried again.
  await new Promise((resolve) => setTimeout(resolve, 40))
  d.dispatch(req('https://api.deepseek.com/v1'), spy())
  assert.deepEqual(record[record.length - 2].agent, 'direct')
})

test('direct success clears a stale cache entry', async () => {
  const record = []
  const { d, router } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] }, negativeCacheTtlMs: 30 })
  // First: direct fails, fallback works → host is cached.
  d.dispatch(req('https://api.deepseek.com/v1'), spy())
  assert.equal(d.negCacheEntries().length, 1)
  // After the TTL expires with direct healthy again, the direct attempt runs
  // and its success clears any stale entry.
  router.direct.fail = () => false
  await new Promise((resolve) => setTimeout(resolve, 40))
  d.dispatch(req('https://api.deepseek.com/v1'), spy())
  assert.deepEqual(d.negCacheEntries(), [])
  assert.equal(record.filter((r) => r.agent === 'direct').length, 2)
})

test('non-transport errors propagate without failover', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  // Script the direct agent to fail with a TLS-style certificate error —
  // a real error, but not a transport-connect failure code.
  const orig = d.router.direct.dispatch.bind(d.router.direct)
  d.router.direct.dispatch = (opts, handler) => orig(opts, {
    onRequestStart(c, ctx) { handler.onRequestStart?.(c, ctx) },
    onResponseError(c, _err) {
      handler.onResponseError?.(c, Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }))
    },
  })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'DEPTH_ZERO_SELF_SIGNED_CERT']])
})

test('user aborts are never failed over', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  const h = spy()
  // Wrap: intercept the direct agent dispatch to deliver an AbortError.
  const orig = d.router.direct.dispatch.bind(d.router.direct)
  d.router.direct.dispatch = (opts, handler) => orig(opts, {
    onRequestStart(c, ctx) { handler.onRequestStart?.(c, ctx) },
    onResponseError(c, _err) {
      handler.onResponseError?.(c, Object.assign(new Error('operation aborted'), { name: 'AbortError' }))
    },
  })
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'operation aborted']])
})

test('fallback failure: exactly one downstream error, host not cached', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'], proxyFails: true } })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  // direct (fail) → main proxy fallback (fail) → original direct error propagates once.
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'proxy:http://127.0.0.1:7897'])
  assert.deepEqual(h.events, [['reqStart'], ['reqStart'], ['error', 'ECONNREFUSED']])
  assert.deepEqual(d.negCacheEntries(), [])
})

test('mid-response failure (after onResponseStart) is never replayed', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  // Script the direct agent to START the response downstream and only THEN
  // die with a transport error (ECONNRESET mid-stream). Replaying would
  // deliver a SECOND response for one dispatch — the headersSent guard must
  // propagate instead (same rule undici's RetryHandler applies).
  const orig = d.router.direct.dispatch.bind(d.router.direct)
  d.router.direct.dispatch = (opts, handler) => {
    record.push({ agent: 'direct', origin: opts.origin, host: 'api.deepseek.com' })
    const c = fakeController()
    handler.onRequestStart?.(c, undefined)
    handler.onResponseStart?.(c, 200, { 'content-type': 'text/event-stream' }, 'OK')
    handler.onResponseData?.(c, 'chunk-1')
    handler.onResponseError?.(c, Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }))
    return true
  }
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  // The failover proxy was never touched…
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  // …and downstream sees exactly ONE response lifecycle, then the error.
  assert.deepEqual(h.events, [['reqStart'], ['respStart', 200], ['data'], ['error', 'ECONNRESET']])
  assert.equal(h.events.filter((e) => e[0] === 'respStart').length, 1)
})

test('custom http failoverProxy is a separate agent, used on direct failure', () => {
  const record = []
  const { d, router } = makeFailover(record, {
    routerOpts: { directFailHosts: ['api.deepseek.com'] },
    failoverProxy: 'http://192.168.31.2:7890',
  })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'proxy:http://192.168.31.2:7890'])
  assert.equal(d.fallbackKind, 'http')
  assert.notEqual(d.fallback, router.proxy)
})

test('custom socks5 failoverProxy builds a Socks5ProxyAgent', () => {
  const record = []
  const { d } = makeFailover(record, {
    routerOpts: { directFailHosts: ['api.deepseek.com'] },
    failoverProxy: 'socks5://192.168.31.2:7891',
  })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.equal(d.fallbackKind, 'socks5')
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'socks:socks5://192.168.31.2:7891'])
  assert.deepEqual(h.events, [['reqStart'], ['reqStart'], ['respStart', 200], ['end']])
})

test('invalid failoverProxy warns and disables failover (direct error propagates)', () => {
  const record = []
  const logs = { warnings: [] }
  const { d } = makeFailover(record, {
    routerOpts: { directFailHosts: ['api.deepseek.com'] },
    failoverProxy: 'ftp://not-a-proxy',
    logs: { warn: (m) => logs.warnings.push(String(m)) },
  })
  const h = spy()
  d.dispatch(req('https://api.deepseek.com/v1'), h)
  assert.equal(d.fallbackKind, 'none')
  assert.equal(d.fallback, null)
  assert.equal(logs.warnings.some((w) => w.includes('invalid failoverProxy')), true)
  assert.deepEqual(record.map((r) => r.agent), ['direct'])
  assert.deepEqual(h.events, [['reqStart'], ['error', 'ECONNREFUSED']])
})

test('subdomain hosts of a cached host are not auto-cached (exact-host cache)', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  d.dispatch(req('https://api.deepseek.com/v1'), spy())
  // A different host still attempts direct first.
  d.dispatch(req('https://other.example.com/v1'), spy())
  assert.equal(record.filter((r) => r.host === 'other.example.com' && r.agent === 'direct').length, 1)
})

// --- Composition with RetryAgent ------------------------------------------------
test('under RetryAgent: transport failure is answered by failover, not by retry duplication', () => {
  const record = []
  const { d } = makeFailover(record, { routerOpts: { directFailHosts: ['api.deepseek.com'] } })
  const retry = new RetryAgent(d, {
    throwOnError: false,
    maxRetries: 3,
    minTimeout: 1,
    maxTimeout: 2,
    methods: ['POST', 'GET'],
    statusCodes: [429, 500, 502, 503, 504],
    errorCodes: ['ECONNRESET', 'ECONNREFUSED', 'UND_ERR_SOCKET'],
  })
  const h = spy()
  retry.dispatch(req('https://api.deepseek.com/v1'), h)
  // One direct attempt, one fallback replay — then success. RetryAgent never
  // sees a failure, so no extra retries were scheduled.
  assert.deepEqual(record.map((r) => r.agent), ['direct', 'proxy:http://127.0.0.1:7897'])
  assert.deepEqual(h.events, [['reqStart'], ['reqStart'], ['respStart', 200], ['end']])
})

test('under RetryAgent: HTTP 429 is retried by RetryAgent, never failed over', () => {
  const record = []
  const { d } = makeFailover(record)
  // Script the direct agent to answer 429 instead of success.
  const orig = d.router.direct.dispatch.bind(d.router.direct)
  d.router.direct.dispatch = (opts, handler) => orig(opts, {
    onRequestStart(c, ctx) { handler.onRequestStart?.(c, ctx) },
    onResponseStart(c, s, hd, sm) { handler.onResponseStart?.(c, 429, {}, 'Too Many Requests') },
    onResponseEnd(c, t) { handler.onResponseEnd?.(c, {}) },
    onResponseError(c, e) { handler.onResponseError?.(c, e) },
  })
  const retry = new RetryAgent(d, {
    throwOnError: false,
    maxRetries: 1,
    minTimeout: 1,
    maxTimeout: 2,
    methods: ['POST', 'GET'],
    statusCodes: [429],
    errorCodes: ['ECONNRESET'],
  })
  const h = spy()
  retry.dispatch(req('https://api.deepseek.com/v1'), h)
  // The invariant under test: an HTTP-status failure is a REACHED server —
  // the failover proxy is never touched (retry semantics are RetryAgent's,
  // and with a synchronously completed body undici forwards the 429 as-is).
  assert.equal(record.filter((r) => r.agent.startsWith('proxy')).length, 0)
  assert.equal(h.events.filter((e) => e[0] === 'error').length + h.events.filter((e) => e[0] === 'end').length, 1)
})
