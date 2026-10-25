// Quick shape check for the built client bundle.
import { readFileSync } from 'node:fs'
const s = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const checks = {
  'ModuleLoader handoff': s.includes('window.__ModuleLoader__.load'),
  'scoped bundle id': /load\(\{\s*id: "@anpiluo\/dsh-proxy"/.test(s),
  'apply exported': /exports\.apply\s*=/.test(s),
  'inject exported': /exports\.inject\s*=/.test(s),
  // dsh ≤ 0.1.6 surface: keyed slot + registered namespace.
  'settings.plugin.item registered': s.includes('settings.plugin.item'),
  'namespace key llm-proxy': s.includes('"llm-proxy"'),
  // dsh ≥ 0.1.7 surface: root list slot + entry-id addressed document.
  'plugins.item registered': s.includes('plugins.item'),
  'configForms service used': s.includes('configForms'),
  'entry id dsh-proxy': s.includes('"dsh-proxy"'),
  'bridge prefix': s.includes('/api/dsh-proxy/settings'),
  'locale zh keys': s.includes('模型代理'),
  // plugins.item renders three times per host: the two summary renderings must
  // stay inline (no <li>), so the bundle has to branch on the render subject.
  'summary view handled': s.includes('"summary"') && s.includes('proxy-model-summary'),
  'summary copy present': s.includes('个模型走代理'),
  // ≥ 0.1.7: DSH owns model input modalities → the switch is replaced by a hint.
  'modality-owned hint': s.includes('multimodal-owned-hint'),
  'direct failover deadline field': s.includes('field-direct-failover-timeout'),
  'directFailoverTimeoutMs wired': s.includes('directFailoverTimeoutMs'),
  // The settings document is bound from the slot callback, not during apply().
  'scope bound lazily': /bound\s*\?\?=/.test(s) || s.includes('??='),
}
let fail = false
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) fail = true
}
process.exit(fail ? 1 : 0)
