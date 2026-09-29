/**
 * dsh ≥ 0.1.7 settings path.
 *
 * On the new host the plugin's `volatile()` Config IS the settings document,
 * addressed by the Loader entry id, and a committed write re-reads the live
 * accessors and emits `loader/volatile-update` on this fiber —
 * `settings.register()`/`watch()` no longer exist. These tests pin the
 * adaptation layer (`plainProxyConfig` + `volatileDocumentSeam`) and the
 * end-to-end `apply()` behaviour on such a host, including the two behaviours
 * that differ from the old host: the multimodal mirror stands down, and the
 * settings document is addressed by entry id rather than namespace.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, Config, plainProxyConfig, volatileDocumentSeam } from '../lib/index.js'

/** A live accessor as dsh 0.1.7 hands a volatile Config field to apply(). */
const live = (value) => ({ get: () => value })

/** Fake ctx for a dsh ≥ 0.1.7 host: settings without register, event bus. */
function makeVolatileCtx({ seam }) {
  const calls = []
  const listeners = new Map()
  const ctx = {
    logger: {
      info: (m) => calls.push(['info', m]),
      warn: (m) => calls.push(['warn', m]),
      error: (m) => calls.push(['error', m]),
    },
    on: (event, fn) => {
      calls.push(['on', event])
      const set = listeners.get(event) ?? new Set()
      set.add(fn)
      listeners.set(event, set)
      return () => set.delete(fn)
    },
    inject: (services, callback) => {
      const sctx = { effect: () => {} }
      for (const service of services) {
        if (service === 'settings') sctx.settings = seam
        if (service === 'webServer') sctx.webServer = { register: (route) => { calls.push(['route', route.path]); return () => {} } }
      }
      callback(sctx)
    },
  }
  return {
    ctx,
    calls,
    emit: (event, payload) => {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(payload)
    },
  }
}

/** A 0.1.7 host seam: describe/mutate only — no register(). */
function makeVolatileSeam({ descriptors = [] } = {}) {
  return {
    writable: true,
    documentPath: 'fake-settings.yaml',
    describe: ({ redactSecrets } = {}) => {
      assert.ok(redactSecrets === true || redactSecrets === undefined)
      return descriptors
    },
    async mutate() {
      throw new Error('volatile seam mutate must not be used in these tests')
    },
  }
}

test('Config parses into the volatile references dsh ≥ 0.1.7 recognises', () => {
  // End-to-end against the real schemastery resolver: the Host only serves a
  // settings form for fields whose schema carries `meta.volatile`, then wraps
  // each parsed value in the shared reference protocol
  // (`@deepseek-ai/cosmokit` createVolatile → `{ get(), [write] }`), which the
  // loader detects as `write in value` — a symbol, so it survives ESM/CJS and
  // duplicated copies of the library.
  const write = Symbol.for('cosmokit.volatile.write')
  for (const [field, schema] of Object.entries(Config.dict ?? {})) {
    assert.equal(schema.meta?.volatile, true, `${field} is marked volatile (volatileForm serves it)`)
  }
  const parsed = Config({ proxyHost: '10.0.0.9', proxiedModels: ['p/m'] })
  assert.equal(typeof parsed.proxyHost.get, 'function', 'proxyHost parses into a live reference')
  assert.ok(write in parsed.proxyHost, 'live reference carries the cosmokit write protocol')
  assert.equal(parsed.proxyHost.get(), '10.0.0.9', 'reference reads back the configured value')
  // …and the plugin's own reader unfolds exactly that shape.
  const plain = plainProxyConfig(parsed)
  assert.equal(plain.proxyHost, '10.0.0.9')
  assert.deepEqual(plain.proxiedModels, ['p/m'])
})

test('plainProxyConfig unwraps live accessors and keeps plain values', () => {
  const plain = plainProxyConfig({
    proxyHost: live('10.0.0.9'),
    proxyPort: live(1080),
    proxiedModels: live(['deepseek-v4-flash/deepseek-v4-flash']),
    retries: live(5),
    trustedOrigins: live(['https://dsh.example.com']),
  })
  assert.equal(plain.proxyHost, '10.0.0.9')
  assert.equal(plain.proxyPort, 1080)
  assert.deepEqual(plain.proxiedModels, ['deepseek-v4-flash/deepseek-v4-flash'])
  assert.equal(plain.retries, 5)
  assert.deepEqual(plain.trustedOrigins, ['https://dsh.example.com'])
  // Fields the document does not carry fall back to the schema defaults.
  assert.equal(plain.retryIntervalMs, 1000)
  assert.equal(plain.failoverEnabled, true)
  assert.equal(plain.negativeCacheTtlMs, 60000)
  // An older host (or a test fake) hands over plain values — same reader.
  assert.equal(plainProxyConfig({ proxyHost: '127.0.0.1' }).proxyHost, '127.0.0.1')
  assert.equal(plainProxyConfig(undefined).proxyHost, '127.0.0.1')
})

test('volatileDocumentSeam maps register/watch onto the live document', () => {
  const events = []
  const ctx = {
    on: (event, fn) => {
      assert.equal(event, 'loader/volatile-update')
      events.push(fn)
      return () => { events.splice(events.indexOf(fn), 1) }
    },
  }
  const seam = makeVolatileSeam()
  // The loader commits a write INTO the accessor's cell; model that with a
  // mutable holder rather than a captured constant.
  const cell = { value: '127.0.0.1' }
  const facade = volatileDocumentSeam(seam, ctx, { proxyHost: { get: () => cell.value } })
  // describe/mutate are delegated verbatim to the real service.
  assert.deepEqual(facade.describe({ redactSecrets: true }), [])

  const scope = facade.register('llm-proxy', Config, {})
  assert.equal(scope.get().proxyHost, '127.0.0.1', 'get() reads the live accessor')

  const seen = []
  const dispose = scope.watch((next) => seen.push(next.proxyHost))
  cell.value = '10.0.0.9'
  for (const fn of events) fn(['proxyHost'])
  assert.deepEqual(seen, ['10.0.0.9'], 'watch re-reads after a volatile commit')

  dispose()
  assert.equal(events.length, 0, 'dispose removes the loader listener')
})

test('apply on a 0.1.7 host installs from the volatile document and re-applies live', async () => {
  const descriptors = [
    {
      ns: 'llm-pi-ai',
      value: { providers: { bai: { baseURL: 'https://api.b.ai' } } },
      base: {},
      user: {},
      revision: 0,
    },
    {
      // Present so the cold-start provider-readiness probe settles: without
      // both provider documents the plugin keeps retrying with backoff timers.
      ns: 'llm-deepseek',
      value: {},
      base: {},
      user: {},
      revision: 0,
    },
  ]
  const seam = makeVolatileSeam({ descriptors })
  const { ctx, calls, emit } = makeVolatileCtx({ seam })
  const config = {
    proxyHost: live('127.0.0.1'),
    proxyPort: live(7897),
    proxiedModels: live(['deepseek-v4-flash/deepseek-v4-flash']),
    multimodalModels: live(['deepseek-v4-flash-vision-exp/deepseek-v4-flash-vision-exp']),
    retries: live(3),
    retryIntervalMs: live(1000),
    trustedOrigins: live([]),
  }

  await apply(ctx, config)

  const installs = () => calls.filter(([kind, msg]) => kind === 'info' && msg.includes('RoutingDispatcher'))
  assert.equal(installs().length, 1, 'installs once from the live document')
  // The install line carries the resolved endpoint: a reference leaked into the
  // router would render as `proxy=[object Object]:[object Object]` and every
  // proxied request would fail, so pin the unwrapping end to end.
  assert.ok(installs()[0][1].includes('proxy=127.0.0.1:7897'), 'endpoint unwrapped from the live accessors')
  assert.ok(!installs()[0][1].includes('[object Object]'), 'no live reference leaked into the dispatcher')
  assert.ok(calls.some(([kind, msg]) => kind === 'info' && msg.includes('served from the volatile Config')), 'new-host path logged')
  assert.ok(!calls.some(([kind, msg]) => kind === 'warn' && String(msg).includes('settings seam unavailable')), 'not treated as a missing seam')
  // The bridge stays mounted for the card's model list and connection test.
  assert.ok(calls.some(([kind, path]) => kind === 'route' && path === '/api/dsh-proxy/settings/models'), 'models route mounted')
  // The multimodal mirror stands down on the new host (the official model
  // settings page owns input modalities there).
  assert.ok(
    calls.some(([kind, msg]) => kind === 'info' && msg.includes('owns model input modalities')),
    'multimodal mirror stand-down logged',
  )

  // A committed settings write mutates the live accessors and emits the event.
  config.proxiedModels = live([])
  emit('loader/volatile-update', ['proxiedModels'])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(installs().length, 2, 'one re-install per volatile commit')
})

test('apply falls back to the resolved config when describe() throws', async () => {
  const seam = {
    writable: true,
    describe: () => { throw new Error('settings service not ready') },
    async mutate() { throw new Error('unused') },
  }
  const { ctx, calls } = makeVolatileCtx({ seam })
  const config = Config({ proxiedModels: [] })
  await apply(ctx, config)
  const installs = calls.filter(([kind, msg]) => kind === 'info' && msg.includes('RoutingDispatcher'))
  assert.ok(installs.length >= 1, 'still installs the dispatcher')
})
