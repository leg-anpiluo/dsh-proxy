/**
 * dsh-llm-proxy v4 — end-to-end smoke test against REAL undici + local servers.
 *
 * Routing semantics under test:
 *   127.0.0.1 → NOT in proxiedHosts → direct server
 *   127.0.0.2 → in proxiedHosts     → proxy server
 *   localhost → always direct (loopback guard)
 *
 * Also verifies retry: a server that 503s the first N requests then succeeds
 * must be retried transparently.
 *
 * Run: node test/smoke-test.mjs
 */
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { setGlobalDispatcher, fetch, RetryAgent } from 'undici'
import { RoutingDispatcher } from '../lib/routing-dispatcher.js'

function listen(server, host = '127.0.0.1') {
  return new Promise((resolve) => server.listen(0, host, () => resolve(server.address().port)))
}
function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

const proxyHits = []
const proxyServer = createServer((req, res) => {
  proxyHits.push(req.url)
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('via-proxy')
})
const directHits = []
const directServer = createServer((req, res) => {
  directHits.push(req.url)
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('direct')
})
const flakyHits = []
const flakyServer = createServer((req, res) => {
  flakyHits.push(req.url)
  if (flakyHits.length <= 1) {
    res.writeHead(503, { 'content-type': 'text/plain' })
    res.end('busy')
    return
  }
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('flaky-ok')
})

const proxyPort = await listen(proxyServer, '127.0.0.1')
const directPort = await listen(directServer, '127.0.0.1')
const flakyPort = await listen(flakyServer, '127.0.0.1')
const undici = await import('undici')
const quietLogger = { info() {}, warn() {}, error() {} }

// --- Scenario A: default direct + proxied host routing --------------------------
const dispatcher = new RoutingDispatcher({
  undici,
  proxyHost: '127.0.0.1',
  proxyPort,
  proxyHosts: ['127.0.0.2'],
  retries: 0,
  logger: quietLogger,
})
setGlobalDispatcher(dispatcher)

// 127.0.0.2 is proxied → the request is forwarded to the proxy server.
const viaProxy = await (await fetch(`http://127.0.0.2:${directPort}/hello`)).text()
assert.equal(viaProxy, 'via-proxy', 'expected proxied host 127.0.0.2 to go through the proxy')
assert.ok(proxyHits.length >= 1, 'proxy server should have been hit')

// 127.0.0.1 is not proxied → direct connection to the direct server.
const direct = await (await fetch(`http://127.0.0.1:${directPort}/bye`)).text()
assert.equal(direct, 'direct', 'expected unselected host 127.0.0.1 to stay direct')
assert.ok(directHits.length >= 1, 'direct server should have been hit')

await dispatcher.close()

// --- Scenario B: retry on 503 (direct path, RetryAgent wrapper) -----------------
const retrying = new RetryAgent(new RoutingDispatcher({
  undici,
  proxyHost: '127.0.0.1',
  proxyPort,
  proxyHosts: ['127.0.0.2'],
  logger: quietLogger,
}), {
  throwOnError: false,
  maxRetries: 3,
  minTimeout: 10,
  timeoutFactor: 1,
  maxTimeout: 20,
  methods: ['POST', 'GET'],
  statusCodes: [429, 500, 502, 503, 504],
})
setGlobalDispatcher(retrying)
const before = flakyHits.length
// 127.0.0.1 is NOT proxied → direct to flakyServer, which 503s once then succeeds.
const flakyResult = await (await fetch(`http://127.0.0.1:${flakyPort}/retry-me`)).text()
assert.equal(flakyResult, 'flaky-ok', 'first 503 must be retried and the retry must succeed')
assert.ok(flakyHits.length >= before + 2, 'at least one retry should have reached the server')
await retrying.close()

await close(proxyServer)
await close(directServer)
await close(flakyServer)
console.log('SMOKE TEST PASSED: default-direct routing, proxied host, 503 retry all verified')
// Let undici's agent pool drain before exiting to avoid a Windows UV assertion.
await new Promise((resolve) => setTimeout(resolve, 50))
process.exit(0)
