/**
 * Client-bundle build check: verifies lib/client.js exists (run `npm run
 * build` first) and carries the loader handoff, the plugin id, both settings
 * surfaces (pre-0.1.7 keyed slot and 0.1.7+ root list slot) and the
 * apply/inject exports the shell expects.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('client bundle is built and well-formed', () => {
  const path = new URL('../lib/client.js', import.meta.url)
  assert.ok(existsSync(path), 'lib/client.js missing — run `npm run build` first')
  const source = readFileSync(path, 'utf8')
  assert.ok(source.includes('window.__ModuleLoader__.load'), 'loader handoff present')
  assert.ok(source.includes('"@anpiluo/dsh-proxy"'), 'scoped bundle id stamped')
  // dsh ≤ 0.1.6: keyed slot, dispatched by the registered settings namespace.
  assert.ok(source.includes('settings.plugin.item'), 'settings.plugin.item card registration present')
  assert.ok(source.includes('"llm-proxy"'), 'namespace key present')
  // dsh ≥ 0.1.7: root list slot declared by dsh-client-ui-plugin-manager, and
  // the settings document addressed by Loader entry id via configForms.
  assert.ok(source.includes('plugins.item'), 'plugins.item card registration present')
  assert.ok(source.includes('configForms'), 'configForms settings service used')
  assert.ok(source.includes('"dsh-proxy"'), 'entry id present')
  assert.ok(/exports\.apply\s*=/.test(source), 'apply exported')
  assert.ok(/exports\.inject\s*=/.test(source), 'inject exported')
  // The settings service must never be a hard inject: on dsh ≥ 0.1.7 neither
  // `settingsScope` nor the old `remote`-only contract may gate this fiber.
  // The bundle emits `exports.inject = inject`, so read the declaration.
  const declaration = source.match(/\binject\s*=\s*(\[[^\]]*\])/)
  assert.ok(declaration !== null, 'inject list emitted')
  assert.ok(declaration[1].includes('"slots"') && declaration[1].includes('"locale"'), 'core UI services required')
  for (const dropped of ['settingsScope', 'connection']) {
    assert.ok(!declaration[1].includes(dropped), `${dropped} must not gate the client fiber`)
  }
})

test('client manifest is declared in package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(pkg.dsh?.client, 'dsh.client manifest missing')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.exports?.['./client'], './lib/client.js')
  // The manifest's inject list gates whether the host loads this bundle at
  // all, so it must not name a service the host dropped (settingsScope went
  // away in dsh 0.1.7 — a required-but-absent service blocks the bundle).
  assert.deepEqual(pkg.dsh.client.inject, ['slots', 'locale'])
})
