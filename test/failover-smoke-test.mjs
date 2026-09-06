/**
 * dsh-llm-proxy v2.0.0 — end-to-end failover smoke test against REAL undici +
 * real local servers (no mocks, no global dispatcher mutation).
 *
 * Target-host note: the direct target binds 127.0.0.2 — the same convention
 * as the routing smoke test — because the failover layer (by design) never
 * touches loopback targets (localhost / 127.0.0.1 / ::1).
 *
 * Failover semantics under test:
 *   - healthy direct: no proxy touched;
 *   - direct dies before response start → ONE transparent replay through the
 *     failover proxy (the main proxy endpoint, as installed by default);
 *   - neg-cache: subsequent requests within the TTL skip the dead direct;
 *   - TTL expiry: direct is probed again;
 *   - failover disabled → the transport error propagates;
 *   - stream bodies never fail over (no proxy hit even when direct fails).
 *
 * Every scenario wraps the dispatcher in RetryAgent with the exact options
 * lib/index.js installs, so composition is exercised end to end.
 *
 * Run: node test/failover-smoke-test.mjs
 */
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { RetryAgent, request } from 'undici'
import { RoutingDispatcher } from '../lib/routing-dispatcher.js'
import { FailoverDispatcher } from '../lib/failover-dispatcher.js'

function listen(server, host = '127.0.0.1') {
  return new Promise((resolve) => server.listen(0, host, () => resolve(server.address().port)))
}
function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

const quiet = { info() {}, warn() {}, error() {}, debug() {} }

// The "proxy": answers absolute-form HTTP proxy requests for any target.
const proxyHits = []
const proxyServer = createServer((req, res) => {
  proxyHits.push(req.url)
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end(`via-proxy:${req.url}`)
})

// The "direct" target (non-loopback loopback alias): when failDirectFor > 0
// the next N requests get their connection destroyed BEFORE response start.
let failDirectFor = 0
const directHits = []
const directServer = createServer((req, res) => {
  directHits.push(req.url)
  if (failDirectFor > 0) {
    failDirectFor -= 1
    req.socket.destroy()
    return
  }
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('direct-ok')
})

const proxyPort = await listen(proxyServer, '127.0.0.1')
const directPort = await listen(directServer, '127.0.0.2')
const undici = await import('undici')

/** Build the exact stack lib/index.js installs (RetryAgent → failover → router). */
function makeStack({ failoverEnabled = true, negativeCacheTtlMs = 1500 } = {}) {
  const router = new RoutingDispatcher({
    undici,
    proxyHost: '127.0.0.1',
    proxyPort,
    proxyHosts: ['proxied.example.com'],
    logger: quiet,
  })
  const failover = new FailoverDispatcher({
    undici,
    router,
    failoverEnabled,
    failoverProxy: '',
    negativeCacheTtlMs,
    logger: quiet,
  })
  return new RetryAgent(failover, {
    throwOnError: false,
    maxRetries: 3,
    minTimeout: 10,
    maxTimeout: 20,
    methods: ['POST', 'GET'],
    statusCodes: [429, 500, 502, 503, 504],
    errorCodes: ['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET'],
  })
}

let failures = 0
function check(label, cond) {
  if (cond) console.log(`  ok - ${label}`)
  else {
    failures += 1
    console.error(`  FAIL - ${label}`)
  }
}

let stack
try {
  // --- 1. Healthy direct: no proxy touched -------------------------------------
  stack = makeStack()
  const r1 = await request(`http://127.0.0.2:${directPort}/live`, { dispatcher: stack })
  const b1 = await r1.body.text()
  check('healthy direct answers "direct-ok" with 200', r1.statusCode === 200 && b1 === 'direct-ok')
  check('healthy direct did not touch the proxy', proxyHits.length === 0)
  await stack.destroy()
  stack = undefined

  // --- 2. Direct dies before response start → transparent failover -------------
  failDirectFor = 1
  stack = makeStack()
  const r2 = await request(`http://127.0.0.2:${directPort}/dies`, { dispatcher: stack })
  const b2 = await r2.body.text()
  check('failover answers 200 through the proxy', r2.statusCode === 200 && b2.startsWith('via-proxy:'))
  check('fallback carried the original absolute-form target', b2.includes(`127.0.0.2:${directPort}`))
  check('proxy saw exactly one fallback request (failover answered before RetryAgent)', proxyHits.length === 1)
  check('direct was attempted exactly once (no retry duplication)', directHits.filter((u) => u === '/dies').length === 1)
  await stack.destroy()
  stack = undefined

  // --- 3. Neg-cache: skip direct while TTL is live, probe again after ----------
  failDirectFor = 1
  stack = makeStack({ negativeCacheTtlMs: 800 })
  await request(`http://127.0.0.2:${directPort}/warm`, { dispatcher: stack }).then((r) => r.body.text())
  const directBefore = directHits.length
  const r3 = await request(`http://127.0.0.2:${directPort}/cached`, { dispatcher: stack })
  await r3.body.text()
  check('cached host skipped direct entirely within the TTL', directHits.length === directBefore)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  failDirectFor = 0
  const r4 = await request(`http://127.0.0.2:${directPort}/recovered`, { dispatcher: stack })
  const b4 = await r4.body.text()
  check('after TTL expiry direct is probed (and answers again)', r4.statusCode === 200 && b4 === 'direct-ok')
  check('TTL probe hit the direct server', directHits.length === directBefore + 1)
  await stack.destroy()
  stack = undefined

  // --- 4. Failover disabled: transport error propagates (raw dispatcher) -------
  const routerOff = new RoutingDispatcher({ undici, proxyHost: '127.0.0.1', proxyPort, proxyHosts: [], logger: quiet })
  const failoverOff = new FailoverDispatcher({ undici, router: routerOff, failoverEnabled: false, logger: quiet })
  failDirectFor = 1
  const proxyBefore4 = proxyHits.length
  let err5 = null
  try {
    const r5 = await request(`http://127.0.0.2:${directPort}/dead`, { dispatcher: failoverOff })
    await r5.body.text()
  } catch (e) {
    err5 = e
  }
  check('disabled failover propagates the transport error', err5 !== null)
  check('disabled failover left the proxy untouched', proxyHits.length === proxyBefore4)

  // --- 5. Stream body: never failed over ---------------------------------------
  stack = makeStack()
  failDirectFor = 1
  const { Readable } = await import('node:stream')
  const streamBody = new Readable({ read() {} })
  streamBody.push('chunk')
  streamBody.push(null)
  const proxyBefore5 = proxyHits.length
  let streamOutcome = 'ok'
  try {
    const r6 = await request(`http://127.0.0.2:${directPort}/stream`, {
      dispatcher: stack,
      method: 'POST',
      body: streamBody,
    })
    await r6.body.text()
  } catch {
    streamOutcome = 'error'
  }
  check(`stream body request never touched the proxy (outcome: ${streamOutcome})`, proxyHits.length === proxyBefore5)
  await stack.destroy()
  stack = undefined

  console.log(failures === 0 ? '\nAll failover smoke checks passed.' : `\n${failures} check(s) FAILED`)
  process.exitCode = failures === 0 ? 0 : 1
} finally {
  if (stack !== undefined) await stack.destroy().catch(() => {})
  await close(proxyServer)
  await close(directServer)
}
