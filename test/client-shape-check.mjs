// Quick shape check for the built client bundle.
import { readFileSync } from 'node:fs'
const s = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const checks = {
  'ModuleLoader handoff': s.includes('window.__ModuleLoader__.load'),
  'bundle id dsh-proxy': /load\(\{\s*id: "dsh-proxy"/.test(s),
  'apply exported': /exports\.apply\s*=/.test(s),
  'inject exported': /exports\.inject\s*=/.test(s),
  'settings.plugin.item registered': s.includes('settings.plugin.item'),
  'card id llm-proxy': s.includes('"llm-proxy"'),
  'bridge prefix': s.includes('/api/dsh-proxy/settings'),
  'locale zh keys': s.includes('模型代理'),
}
let fail = false
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) fail = true
}
process.exit(fail ? 1 : 0)
