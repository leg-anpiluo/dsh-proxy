import { name, Config } from '../lib/index.js'

const calls = []
const ctx = {
  logger: {
    info: (m) => calls.push(['info', m]),
    warn: (m) => calls.push(['warn', m]),
    error: (m) => calls.push(['error', m]),
  },
  on: (ev, fn) => calls.push(['on', ev, typeof fn]),
}
console.log('plugin name:', name)
console.log('Config is schema:', typeof Config === 'function')

await (await import('../lib/index.js')).apply(
  ctx,
  Config({
    proxies: { clash: 'http://127.0.0.1:7897' },
    routes: { 'api.b.ai': 'clash' },
  }),
)
for (const c of calls) console.log(c[0], '→', c[1] ?? '')
const disp = calls.find((c) => c[0] === 'on' && c[1] === 'dispose')
console.log('dispose hook registered:', !!disp)
console.log('LOAD TEST PASSED')
process.exit(0)
