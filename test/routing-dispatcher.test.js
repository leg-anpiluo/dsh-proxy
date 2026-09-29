/**
 * dsh-proxy v4 鈥?unit tests for RoutingDispatcher (pure router) and the
 * undici RetryAgent wrapper that provides retry.
 *
 * Routing semantics: loopback hosts always go DIRECT; hosts in the proxied
 * host set go through the single ProxyAgent; everything else stays DIRECT.
 *
 * Retry semantics (undici official RetryAgent): transport errors, HTTP 429
 * and 5xx replay the request up to `maxRetries` times with a fixed interval.
 *
 * Uses a fake undici shim (Agent/ProxyAgent recording dispatch targets) so no
 * real network or proxy is touched. Run: node --test test/*.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RoutingDispatcher } from '../lib/routing-dispatcher.js'
import { RetryAgent } from 'undici'

// --- Fake undici -------------------------------------------------------------
function makeUndici(record) {
  class FakeAgent {
    constructor() {
      this.name = 'direct'
    }
    dispatch(opts, handler) {
      record.push({ agent: 'direct', origin: opts.origin, host: opts.host })
      handler?.onResponseStart?.(200, {}, 'OK', opts.origin)
      handler?.onResponseEnd?.(null, {})
      return true
    }
    close() {
      return Promise.resolve()
    }
    destroy() {
      return Promise.resolve()
    }
  }
  class FakeProxyAgent extends FakeAgent {
    constructor(uriOrOpts) {
      // Mirror undici's ProxyAgent: accepts either a URI string or an options
      // object ({ uri, ... }); a malformed URL throws at construction.
      const uri = typeof uriOrOpts === 'string' ? uriOrOpts : uriOrOpts?.uri
      if (typeof uri !== 'string' || !/^https?:\/\/[^/\s]+(:\d+)?$/.test(uri)) {
        throw new Error('Invalid URL')
      }
      super()
      this.name = `proxy:${uri}`
      this.uri = uri
    }
    dispatch(opts, handler) {
      record.push({ agent: `proxy:${this.uri}`, origin: opts.origin, host: opts.host })
      handler?.onResponseStart?.(200, {}, 'OK', opts.origin)
      handler?.onResponseEnd?.(null, {})
      return true
    }
  }
  return { Agent: FakeAgent, ProxyAgent: FakeProxyAgent }
}

function req(origin, signal) {
  return { origin, path: '/v1/chat/completions', method: 'POST', headers: [], signal }
}

function makeDispatcher(record, overrides = {}) {
  return new RoutingDispatcher({
    undici: makeUndici(record),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
    ...overrides,
  })
}

// --- Routing ------------------------------------------------------------------
test('default is DIRECT: unselected hosts do not touch the proxy', () => {
  const record = []
  const d = makeDispatcher(record)
  d.dispatch(req('https://api.deepseek.com/v1'), {})
  assert.equal(record.length, 1)
  assert.equal(record[0].agent, 'direct')
})

test('selected proxied hosts go through the proxy', () => {
  const record = []
  const d = makeDispatcher(record, { proxyHosts: ['api.b.ai'] })
  d.dispatch(req('https://api.b.ai/v1'), {})
  assert.equal(record.length, 1)
  assert.equal(record[0].agent, 'proxy:http://127.0.0.1:7897')
})

test('loopback hosts are always direct, even when proxied', () => {
  const record = []
  const d = makeDispatcher(record, { proxyHosts: ['localhost', '127.0.0.1'] })
  d.dispatch(req('http://localhost:3080/'), {})
  d.dispatch(req('http://127.0.0.1:3080/'), {})
  assert.equal(record.length, 2)
  assert.ok(record.every((r) => r.agent === 'direct'))
})

test('subdomain of a proxied host also goes through the proxy', () => {
  const record = []
  const d = makeDispatcher(record, { proxyHosts: ['b.ai'] })
  d.dispatch(req('https://api.b.ai/v1'), {})
  assert.equal(record[0].agent, 'proxy:http://127.0.0.1:7897')
})

test('missing proxy agent falls back to direct', () => {
  const record = []
  const d = new RoutingDispatcher({
    undici: makeUndici(record),
    proxyHost: 'not a url',
    proxyPort: 99999,
    proxyHosts: ['api.b.ai'],
  })
  d.dispatch(req('https://api.b.ai/v1'), {})
  assert.equal(record[0].agent, 'direct')
})

test('closed dispatcher rejects new requests', () => {
  const record = []
  const d = makeDispatcher(record)
  d.closed = true
  let failed = null
  d.dispatch(req('https://api.deepseek.com/v1'), { onResponseError: (_, err) => { failed = err } })
  assert.ok(failed instanceof Error)
})

// --- RetryAgent wrapper (undici official) -------------------------------------
function makeFailingUndici(record, { failTimes = 1, failStatus } = {}) {
  class FakeAgent {
    constructor() {
      this.name = 'direct'
    }
    dispatch(opts, handler) {
      record.push({ agent: 'direct', origin: opts.origin, host: opts.host })
      const attempt = record.filter((r) => r.origin === opts.origin).length
      if (attempt <= failTimes && failStatus !== undefined) {
        // Retryable response: hand out a pausable controller. The body
        // completes only once `resume()` is called (RetryHandler pauses it
        // while deciding, resumes on the next attempt).
        const controller = makeController(() => handler?.onResponseEnd?.(null, {}))
        handler?.onRequestStart?.(controller)
        handler?.onResponseStart?.(controller, failStatus, {}, 'FAIL')
        return true
      }
      if (attempt <= failTimes) {
        handler?.onResponseError?.(null, new Error('ECONNRESET'))
        return true
      }
      // Success: undici pushes the response immediately.
      const controller = makeController(null)
      handler?.onRequestStart?.(controller)
      handler?.onResponseStart?.(controller, 200, {}, 'OK')
      handler?.onResponseEnd?.(null, {})
      return true
    }
    close() {
      return Promise.resolve()
    }
    destroy() {
      return Promise.resolve()
    }
  }
  return { Agent: FakeAgent, ProxyAgent: FakeAgent }
}

/**
 * A minimal controller shim satisfying RetryHandler's pause/resume/abort:
 * the body/end callbacks fire only after `resume()` (matching undici's
 * paused-connection behaviour), so retry can pause an attempt and resume the
 * next one without the failed response racing ahead.
 */
function makeController(onResumed) {
  let resumed = false
  return {
    paused: true,
    aborted: false,
    reason: null,
    rawHeaders: null,
    rawTrailers: null,
    pause() { this.paused = true },
    resume() {
      this.paused = false
      if (!resumed) {
        resumed = true
        onResumed?.()
      }
    },
    abort(reason) { this.aborted = true; this.reason = reason },
  }
}

function settle() {
  const handler = {}
  const promise = new Promise((resolve) => {
    let status = null
    let error = null
    // undici signature: onResponseStart(controller, status, headers, statusText)
    handler.onResponseStart = (controller, code) => { status = code }
    handler.onResponseEnd = () => resolve({ status, error })
    handler.onResponseError = (_, err) => { error = err; resolve({ status, error }) }
  })
  return { handler, promise }
}

test('RetryAgent: transport error retries and then succeeds', async () => {
  const record = []
  const router = new RoutingDispatcher({
    undici: makeFailingUndici(record, { failTimes: 1 }),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
  })
  const retry = new RetryAgent(router, {
    throwOnError: false,
    maxRetries: 2,
    minTimeout: 1,
    timeoutFactor: 1,
    maxTimeout: 5,
    methods: ['POST'],
    statusCodes: [429, 500, 502, 503, 504],
  })
  const { handler, promise } = settle()
  retry.dispatch(req('https://api.deepseek.com/v1'), handler)
  const out = await promise
  assert.equal(out.status, 200)
  assert.equal(record.length, 2, 'one failure + one retry')
})

test('RetryAgent: HTTP 429 retries and then succeeds', async () => {
  const record = []
  const router = new RoutingDispatcher({
    undici: makeFailingUndici(record, { failTimes: 1, failStatus: 429 }),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
  })
  const retry = new RetryAgent(router, {
    throwOnError: false,
    maxRetries: 2,
    minTimeout: 1,
    timeoutFactor: 1,
    maxTimeout: 5,
    methods: ['POST'],
    statusCodes: [429, 500, 502, 503, 504],
  })
  const { handler, promise } = settle()
  retry.dispatch(req('https://api.deepseek.com/v1'), handler)
  const out = await promise
  assert.equal(out.status, 200)
  assert.equal(record.length, 2)
})

test('RetryAgent: HTTP 503 retries and then succeeds', async () => {
  const record = []
  const router = new RoutingDispatcher({
    undici: makeFailingUndici(record, { failTimes: 2, failStatus: 503 }),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
  })
  const retry = new RetryAgent(router, {
    throwOnError: false,
    maxRetries: 3,
    minTimeout: 1,
    timeoutFactor: 1,
    maxTimeout: 5,
    methods: ['POST'],
    statusCodes: [429, 500, 502, 503, 504],
  })
  const { handler, promise } = settle()
  retry.dispatch(req('https://api.deepseek.com/v1'), handler)
  const out = await promise
  assert.equal(out.status, 200)
  assert.equal(record.length, 3, 'two failures + one retry')
})

test('RetryAgent: exhausted retries surface the final error', async () => {
  const record = []
  const router = new RoutingDispatcher({
    undici: makeFailingUndici(record, { failTimes: 99 }),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
  })
  const retry = new RetryAgent(router, {
    throwOnError: false,
    maxRetries: 2,
    minTimeout: 1,
    timeoutFactor: 1,
    maxTimeout: 5,
    methods: ['POST'],
    statusCodes: [429, 500, 502, 503, 504],
  })
  const { handler, promise } = settle()
  retry.dispatch(req('https://api.deepseek.com/v1'), handler)
  const out = await promise
  assert.ok(out.error instanceof Error)
  assert.equal(record.length, 3, 'initial attempt + 2 retries')
})

test('RetryAgent: retries disabled (0) forwards the failure immediately', async () => {
  const record = []
  const router = new RoutingDispatcher({
    undici: makeFailingUndici(record, { failTimes: 99 }),
    proxyHost: '127.0.0.1',
    proxyPort: 7897,
  })
  const retry = new RetryAgent(router, {
    throwOnError: false,
    maxRetries: 0,
    methods: ['POST'],
    statusCodes: [429, 500, 502, 503, 504],
  })
  const { handler, promise } = settle()
  retry.dispatch(req('https://api.deepseek.com/v1'), handler)
  const out = await promise
  assert.ok(out.error instanceof Error)
  assert.equal(record.length, 1)
})

// --- Proxy endpoint normalization (upstream v1.3.0 port) ----------------------
test('a bare host builds an http endpoint with the configured port', () => {
  const d = makeDispatcher([], { proxyHost: '127.0.0.1', proxyPort: 7897, proxyHosts: ['api.b.ai'] })
  assert.equal(d.proxyEndpoint, 'http://127.0.0.1:7897')
  assert.equal(d.proxy.uri, 'http://127.0.0.1:7897')
})

test('a pasted proxy URL is not double-schemed', () => {
  // `http://http://host:7897` would break every proxied request; the scheme
  // and embedded port of a full URL must be adopted instead.
  const d = makeDispatcher([], { proxyHost: 'http://10.0.0.9:1080', proxyPort: 7897, proxyHosts: ['api.b.ai'] })
  assert.equal(d.proxyEndpoint, 'http://10.0.0.9:1080')
  assert.equal(d.proxy.uri, 'http://10.0.0.9:1080')
  assert.equal(d.proxyHost, '10.0.0.9')
  assert.equal(d.proxyPort, 1080)
})

test('a socks5 endpoint keeps its scheme and the configured port', () => {
  const d = makeDispatcher([], { proxyHost: 'socks5://10.0.0.9', proxyPort: 1080, proxyHosts: ['api.b.ai'] })
  assert.equal(d.proxyEndpoint, 'socks5://10.0.0.9:1080')
})

// --- Borrowed direct dispatcher (official dsh-http-proxy cooperation) ---------
test('a chained direct dispatcher carries the direct path', () => {
  const record = []
  const borrowed = []
  const upstream = {
    dispatch(opts, handler) {
      borrowed.push(opts.origin)
      handler?.onResponseStart?.(200, {}, 'OK', opts.origin)
      handler?.onResponseEnd?.(null, {})
      return true
    },
    close() { borrowed.push('close') },
    destroy() { borrowed.push('destroy') },
  }
  const d = makeDispatcher(record, { proxyHosts: ['api.b.ai'], directDispatcher: upstream })
  // Unselected host → the deployment's own dispatcher, not a private Agent.
  d.dispatch(req('https://api.deepseek.com/v1'), {})
  assert.deepEqual(borrowed, ['https://api.deepseek.com/v1'])
  assert.equal(record.length, 0, 'private Agent not used for the direct path')
  // Pinned host still rides this plugin's ProxyAgent.
  d.dispatch(req('https://api.b.ai/v1'), {})
  assert.equal(record.length, 1)
})

test('a borrowed direct dispatcher is never closed or destroyed', () => {
  // Retiring our stack must not tear down the host's own transport.
  const borrowed = []
  const upstream = {
    dispatch: () => true,
    close() { borrowed.push('close') },
    destroy() { borrowed.push('destroy') },
  }
  const d = makeDispatcher([], { directDispatcher: upstream })
  assert.equal(d.directOwned, false)
  d.close()
  d.destroy()
  assert.deepEqual(borrowed, [], 'borrowed dispatcher left alone')
})

test('a private direct dispatcher is still closed and destroyed', () => {
  const d = makeDispatcher([])
  assert.equal(d.directOwned, true)
  assert.ok(d.direct instanceof Object, 'private Agent created')
  d.close()
  d.destroy()
})
