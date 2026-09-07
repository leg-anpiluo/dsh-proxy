/**
 * dsh-proxy v2.0.1 — regression tests for the global-dispatcher installer.
 *
 * The published 2.0.0 shipped a teardown bug: undici's `setGlobalDispatcher()`
 * returns undefined, so the old `previous = setGlobalDispatcher(next)` capture
 * left `previous` undefined; dispose then called `setGlobalDispatcher(undefined)`
 * (real undici throws InvalidArgumentError, swallowed by the try/catch) and the
 * global fetch stack stayed pointed at the plugin's DESTROYED dispatcher —
 * every later request in the host process failed until a restart. These tests
 * pin the fixed semantics with a fake undici (the real global dispatcher is
 * never touched):
 *   - first install captures the pre-plugin dispatcher via getGlobalDispatcher
 *     and teardown restores it;
 *   - re-install (live settings save) retires the replaced stack gracefully:
 *     close() immediately, force-destroy() only after the grace period —
 *     in-flight streaming requests are not cut by a settings save;
 *   - teardown (plugin going away) destroys the current stack immediately;
 *   - teardown without any install is a no-op.
 *
 * Run: node --test test/installer.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeInstaller, Config } from '../lib/index.js'

const quietLogger = { info() {}, warn() {}, error() {}, debug() {} }

/**
 * Fake undici module: every constructed dispatcher records close/destroy
 * calls, and the global slot validates like undici 8.x (setGlobalDispatcher
 * rejects non-dispatchers and returns undefined).
 */
function makeFakeUndici() {
  const state = { global: null }
  class FakeDispatcher {
    constructor(kind) {
      this.kind = kind
      this.closeCalls = 0
      this.destroyCalls = 0
    }
    dispatch() { return true }
    close() { this.closeCalls += 1; return Promise.resolve() }
    destroy() { this.destroyCalls += 1; return Promise.resolve() }
  }
  class FakeAgent extends FakeDispatcher { constructor() { super('Agent') } }
  class FakePool extends FakeDispatcher { constructor() { super('Pool') } }
  class FakeProxyAgent extends FakeDispatcher {
    constructor(uriOrOpts) {
      super('ProxyAgent')
      this.uri = typeof uriOrOpts === 'string' ? uriOrOpts : uriOrOpts?.uri
    }
  }
  class FakeRetryAgent extends FakeDispatcher {
    constructor(composed, opts) {
      super('RetryAgent')
      this.composed = composed
      this.opts = opts
    }
  }
  return {
    state,
    Agent: FakeAgent,
    Pool: FakePool,
    ProxyAgent: FakeProxyAgent,
    Socks5ProxyAgent: FakeProxyAgent,
    RetryAgent: FakeRetryAgent,
    getGlobalDispatcher: () => state.global,
    setGlobalDispatcher(dispatcher) {
      if (dispatcher === null || typeof dispatcher?.dispatch !== 'function') {
        throw new TypeError('argument must be a Dispatcher')
      }
      state.global = dispatcher
    },
  }
}

test('teardown restores the pre-plugin dispatcher (2.0.0 regression)', () => {
  const undici = makeFakeUndici()
  const original = new undici.Agent()
  undici.state.global = original
  const installer = makeInstaller({ logger: quietLogger }, undici)

  installer.install(undefined, Config({}))
  const installed = undici.state.global
  assert.notEqual(installed, original, 'the plugin stack is installed globally')
  assert.equal(installed.kind, 'RetryAgent', 'the installed root is the RetryAgent wrapper')

  installer.teardown()
  // The 2.0.0 bug: `previous` captured undefined, so this either restored
  // undefined (throwing, swallowed) or left the destroyed plugin stack global.
  assert.equal(undici.state.global, original, 'the ORIGINAL dispatcher is back on the global slot')
  assert.equal(installed.destroyCalls, 1, 'the plugin stack is destroyed on dispose')
})

test('re-install retires the replaced stack gracefully (close now, destroy after grace)', async () => {
  const undici = makeFakeUndici()
  const original = new undici.Agent()
  undici.state.global = original
  const installer = makeInstaller({ logger: quietLogger }, undici, { retireGraceMs: 10 })

  installer.install(undefined, Config({}))
  const first = undici.state.global
  installer.install(undefined, Config({ retries: 1 }))
  const second = undici.state.global
  assert.notEqual(second, first, 'a settings save swaps in a fresh stack')
  assert.equal(undici.state.global, second)

  // The replaced stack closes immediately…
  assert.equal(first.closeCalls, 1, 'replaced stack closes right away')
  assert.equal(first.destroyCalls, 0, '…but is NOT destroyed: in-flight streams finish on it')

  // …and the grace expiry force-reaps anything still stuck.
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(first.destroyCalls, 1, 'grace expiry force-destroys the retired stack')

  // `previous` is captured once: teardown still restores the pre-plugin dispatcher.
  installer.teardown()
  assert.equal(undici.state.global, original, 'teardown still restores the original after re-installs')
})

test('teardown without install is a no-op', () => {
  const undici = makeFakeUndici()
  const original = new undici.Agent()
  undici.state.global = original
  const installer = makeInstaller({ logger: quietLogger }, undici)
  installer.teardown()
  assert.equal(undici.state.global, original, 'the global slot is untouched')
  assert.equal(original.destroyCalls, 0, 'nothing was destroyed')
})
