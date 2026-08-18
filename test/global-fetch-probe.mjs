/**
 * Probe: does npm-undici's setGlobalDispatcher actually intercept Node's
 * GLOBAL fetch (globalThis.fetch) — i.e. the very calls the DSH LLM adapters
 * make? The existing smoke test imports `fetch` from 'undici' directly, which
 * only proves the RoutingDispatcher works with that copy. This probe proves
 * the real-world path.
 *
 * Run: node test/global-fetch-probe.mjs
 */
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { setGlobalDispatcher } from 'undici'
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

const proxyPort = await listen(proxyServer, '127.0.0.1')
const directPort = await listen(directServer, '127.0.0.1')
const undici = await import('undici')
const quietLogger = { info() {}, warn() {}, error() {} }

// Route: 127.0.0.2 → proxy (via the proxy server on 127.0.0.1), 127.0.0.1 → direct.
// Uses GLOBAL fetch.
const dispatcher = new RoutingDispatcher({
  undici,
  proxyHost: '127.0.0.1',
  proxyPort,
  proxyHosts: ['127.0.0.2'],
  logger: quietLogger,
})
setGlobalDispatcher(dispatcher)

const viaProxy = await (await globalThis.fetch(`http://127.0.0.2:${directPort}/hello`)).text()
assert.equal(viaProxy, 'via-proxy', 'GLOBAL fetch to a proxied host must reach the proxy server')
assert.ok(proxyHits.length >= 1, 'proxy server should have been hit')

const direct = await (await globalThis.fetch(`http://127.0.0.1:${directPort}/bye`)).text()
assert.equal(direct, 'direct', 'GLOBAL fetch to an unselected host must go direct')
assert.ok(directHits.length >= 1, 'direct server should have been hit')

await dispatcher.close()
await close(proxyServer)
await close(directServer)
console.log(
  `GLOBAL-FETCH PROBE PASSED: npm undici dispatcher intercepts globalThis.fetch ` +
    `(routed=${proxyHits.length}, direct=${directHits.length})`,
)
// No process.exit(): let the loop drain so Windows libuv teardown stays clean.
