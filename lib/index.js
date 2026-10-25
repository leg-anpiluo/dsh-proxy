/**
 * @anpiluo/dsh-proxy v2.0.1 — per-model proxy routing + retry + direct
 * failover for DSH LLM requests (and every other fetch), configurable live from
 * the DSH 设置 page (模型代理).
 *
 * v2.0.1 (teardown + retirement fixes):
 *
 *   - **teardown 恢复原 dispatcher**：`setGlobalDispatcher()` 在 undici 8.x
 *     返回 undefined，旧实现把它当作「插件安装前的 dispatcher」捕获；dispose
 *     时全局 fetch 悬在已销毁的插件栈上，宿主进程重启前所有请求失败。现在首次
 *     install 用 `getGlobalDispatcher()` 显式捕获并还原。
 *   - **保存设置不再掐断进行中的流式请求**：被替换的旧 dispatcher 栈先
 *     `close()` 优雅退役（在途请求跑完），宽限期后才强制 `destroy()`。
 *   - **mid-response 不回退**：响应已开始后再发生的传输层失败不回重放请求
 *     （lib/failover-dispatcher.js 的 headersSent 守卫，对齐 undici RetryHandler）。
 *
 * v2.0.0 (direct failover, absorbing the dsh-proxy-switch use case):
 *
 *   - **直连失败自动回退**：hosts the router keeps on the DIRECT path (search,
 *     web fetch, domestic APIs — anything not pinned to the proxy) are
 *     replayed ONCE through the failover proxy when the direct connection
 *     fails at transport level before any response byte
 *     (lib/failover-dispatcher.js). On by default; the failover endpoint is
 *     the main proxy (`proxyHost:proxyPort`) unless `failoverProxy` sets a
 *     dedicated one (http/https/socks5).
 *   - **失败主机负缓存**：a host whose fallback just succeeded skips the
 *     doomed direct attempt for `negativeCacheTtlMs`; a later successful
 *     direct attempt clears the entry again.
 *   - **重试分工**：RetryAgent keeps 429/5xx (a reached server) and narrows
 *     its transport codes to mid-response failures; CONNECT-level failures
 *     are the failover layer's job — no double hammering of dead paths.
 *
 * v1.0.3 (retry-policy mirroring + pi-ai catalog fallback, on top of v1.0.0):
 *
 *   - **pi-ai 目录回退**：只配了 `apiKeyEnv` 的 provider（如 `xiaomi`）的模型列表
 *     从 pi-ai 内置目录（`@earendil-works/pi-ai`）补齐，与官方模型选择器同步；
 *     `resolveProxyHosts` / `syncRetryPolicy` / 设置卡片列表共用同一回退（lib/catalog.js）。
 *   - **retryPolicy 镜像**：卡片 `retries` / `retryIntervalMs` 镜像进被勾选
 *     provider 的官方 `retryPolicy`，取消勾选还原默认（lib/index.js）。
 *
 * v1.0.0 (model-level intent, replacing the earlier hostname-routing +
 * token-bucket design):
 *
 *   - **Two-part proxy endpoint** (`proxyHost` + `proxyPort`, default
 *     127.0.0.1:7897) — the proxy does not have to live on this machine.
 *   - **走代理的模型** (`proxiedModels`): the user picks models from the
 *     configured model list (llm-pi-ai + llm-deepseek providers); the
 *     selected models' baseURL hosts go through the proxy, everything else
 *     stays DIRECT (domestic APIs etc.). Loopback hosts are always direct.
 *   - **Retry** (`retries` / `retryIntervalMs`, default 3 / 1000ms): a
 *     transport error, HTTP 429 or any 5xx restarts the request. This keeps
 *     requests alive when a provider rate-limits — the earlier token-bucket
 *     queue is gone.
 *
 * Everything happens at the fetch layer via `setGlobalDispatcher`, below the
 * LLM adapter: `ctx.llm` providers and settings.yaml stay untouched.
 */
import Schema from '@deepseek-ai/schemastery'
import { RoutingDispatcher } from './routing-dispatcher.js'
import { FailoverDispatcher } from './failover-dispatcher.js'
import { makeBridgeRoutes } from './settings.js'
import { catalogBuiltinModels, ensureCatalog } from './catalog.js'
import { DEEPSEEK_OFFICIAL_PROVIDER_ID, deepSeekConnection } from './deepseek-official.js'

export const name = 'dsh-proxy'

/**
 * Cordis Loader entry id this plugin is composed under (cordis.patch.yml).
 *
 * dsh ≥ 0.1.7 addresses a plugin's settings document by this id instead of by
 * a registered namespace, so it is the key the browser half asks the
 * `configForms` service for. It is deliberately NOT `LLM_PROXY_NAMESPACE`:
 * the id was renamed from `llm-proxy` to `dsh-proxy` in v2.0.3 to stop
 * colliding with the upstream package, while the persisted settings namespace
 * stays `llm-proxy` (renaming it would orphan saved user documents).
 */
export const LLM_PROXY_ENTRY_ID = 'dsh-proxy'

/**
 * Schemastery `Schema#volatile` gate.
 *
 * dsh ≥ 0.1.7 derives the plugin's settings document from this schema and only
 * offers a form (and only accepts writes) for paths marked volatile. In
 * schemastery ≥ 3.18.4 that marker is one line —
 * `volatile() { return this.extra("volatile", true) }` — and an older copy of
 * the library can still set it, because `extra()` has always been a plain
 * `meta[key] = value`. Verified against the real resolver: the marker is
 * `meta.volatile`, and the Host wraps the parsed value in
 * `{ get(), [Symbol.for('cosmokit.volatile.write')] }`, which the loader then
 * recognises via `write in value`. Setting the marker directly therefore keeps
 * this plugin working even when a hoisted/singleton older schemastery wins
 * resolution; only a library with neither method leaves the fields static, and
 * that case warns instead of silently serving no settings card.
 * @param schema - the field schema.
 */
let warnedNoVolatile = false
function live(schema) {
  if (typeof schema?.volatile === 'function') return schema.volatile()
  if (typeof schema?.extra === 'function') return schema.extra('volatile', true)
  if (!warnedNoVolatile) {
    warnedNoVolatile = true
    console.warn(
      'dsh-proxy: this @deepseek-ai/schemastery copy exposes neither Schema#volatile nor Schema#extra — '
      + 'Config fields stay static, so the 设置 → 插件 → 模型代理 card is not served on dsh ≥ 0.1.7 '
      + '(edit cordis.patch.yml instead)',
    )
  }
  return schema
}

/**
 * Deployment configuration; every tunable is validated at load. The
 * pre-1.0.0 fields (proxyUrl, proxies, routes, defaultProxy, rateLimits,
 * maxQueueDepth) are intentionally gone.
 *
 * Every field is wrapped in `live()`: on dsh ≥ 0.1.7 the loader hands volatile
 * fields to `apply()` as live accessors and commits a settings write into them
 * in place (then emits `loader/volatile-update` on this fiber), which is the
 * whole live-settings mechanism now that `settings.register()` is gone.
 */
export const Config = Schema.object({
  /** Proxy hostname/IP; does not have to be this machine. */
  proxyHost: live(Schema.string().default('127.0.0.1')),
  /** Proxy port. */
  proxyPort: live(Schema.number().min(1).max(65535).step(1).default(7897)),
  /**
   * Model keys whose baseURL hosts route through the proxy. Each entry is
   * `<providerId>/<modelId>` resolved against the configured model list
   * (llm-pi-ai + llm-deepseek); unknown keys are ignored with a warning.
   */
  proxiedModels: live(Schema.array(Schema.string()).default([])),
  /** Maximum retry attempts for a failed request (transport error / 429 / 5xx). */
  retries: live(Schema.number().min(0).max(10).step(1).default(3)),
  /** Delay between retry attempts, in milliseconds. */
  retryIntervalMs: live(Schema.number().min(0).max(60000).step(1).default(1000)),
  /**
   * v2.0.0 direct failover: when a DIRECT-path request (hosts NOT routed
   * through the proxy — search, web fetch, domestic APIs) fails at transport
   * level before any response byte, the request is replayed once through the
   * failover proxy. On by default; the failover endpoint is the main proxy
   * (`proxyHost:proxyPort`) unless `failoverProxy` overrides it.
   */
  failoverEnabled: live(Schema.boolean().default(true)),
  /**
   * Failover endpoint override (http://, https:// or socks5:// URL).
   * Empty string reuses the main proxy endpoint.
   */
  failoverProxy: live(Schema.string().default('')),
  /**
   * How long (ms) a host whose direct attempt just failed over stays on the
   * proxy path without retrying direct first. 0 disables the cache (every
   * request pays the direct attempt again).
   */
  negativeCacheTtlMs: live(Schema.number().min(0).max(3600000).step(1000).default(60000)),
  // Direct-attempt deadline for idempotent reads (GET/HEAD): a blackholed
  // route would otherwise sit on undici's 300 s headers timeout before the
  // failover replay ever happens. 0 disables it; POST is never cut short.
  directFailoverTimeoutMs: live(Schema.number().min(0).max(600000).step(1000).default(30000)),
  /**
   * Public origins trusted by the settings bridge when this deployment sits
   * behind a reverse proxy (e.g. `https://dsh.example.com`). Such a request
   * still arrives on a loopback socket but its Host/Origin name the public
   * domain, which the plain loopback-host check would refuse. Empty (default)
   * keeps the bridge reachable from this machine only. The same-origin CSRF
   * check always applies on top.
   */
  trustedOrigins: live(Schema.array(Schema.string()).default([])),
})

/**
 * One Config field's current value, unwrapping the live accessor dsh 0.1.7
 * hands over for a `volatile()` field. Falls back to the plain value so an
 * older host's resolved config (and the test fakes) keep working.
 * @param config - resolved plugin config (live accessors or plain values).
 * @param key - field name.
 * @param fallback - value when the field is absent or undefined.
 * @returns the current plain value.
 */
function fieldValue(config, key, fallback) {
  const node = config?.[key]
  if (node !== undefined && node !== null && typeof node.get === 'function') {
    const value = node.get()
    return value === undefined ? fallback : value
  }
  return node === undefined || node === null ? fallback : node
}

/**
 * Plain resolved proxy configuration from the config object `apply()` was
 * given — the single reader every install path shares, so live accessors and
 * plain objects behave identically.
 * @param config - the resolved plugin config.
 * @returns detached plain values.
 */
export function plainProxyConfig(config) {
  return {
    proxyHost: fieldValue(config, 'proxyHost', '127.0.0.1'),
    proxyPort: fieldValue(config, 'proxyPort', 7897),
    proxiedModels: fieldValue(config, 'proxiedModels', []) ?? [],
    retries: fieldValue(config, 'retries', 3),
    retryIntervalMs: fieldValue(config, 'retryIntervalMs', 1000),
    failoverEnabled: fieldValue(config, 'failoverEnabled', true),
    failoverProxy: fieldValue(config, 'failoverProxy', ''),
    negativeCacheTtlMs: fieldValue(config, 'negativeCacheTtlMs', 60000),
    directFailoverTimeoutMs: fieldValue(config, 'directFailoverTimeoutMs', 30000),
    trustedOrigins: fieldValue(config, 'trustedOrigins', []) ?? [],
  }
}

/** Hostname for a baseURL, or '' when unparseable. */
function hostOf(baseURL) {
  try {
    return new URL(baseURL).hostname
  } catch {
    return ''
  }
}

/**
 * Resolve the proxied-model selection into the set of hostnames the
 * RoutingDispatcher should route through the proxy. Reads the configured
 * model list off the settings seam (`llm-pi-ai` + `llm-deepseek`
 * namespaces); entries that match a selected model key contribute their
 * baseURL host.
 *
 * @param settings - the host settings seam (`ctx.settings`), when available.
 * @param proxiedModels - configured model keys (`<providerId>/<modelId>`).
 * @param logger - cordis logger.
 * @returns the hostnames to proxy.
 */
export function resolveProxyHosts(settings, proxiedModels, logger) {
  const selected = new Set(proxiedModels ?? [])
  if (selected.size === 0) return []
  if (!settings || typeof settings.describe !== 'function') return []

  const hosts = new Set()
  try {
    const descriptors = settings.describe({ redactSecrets: true })
    for (const descriptor of descriptors) {
      const ns = String(descriptor.ns)
      const value = descriptor.value
      if (typeof value !== 'object' || value === null) continue
      if (ns === 'llm-pi-ai' && typeof value.providers === 'object' && value.providers !== null) {
        for (const [providerId, profile] of Object.entries(value.providers)) {
          if (typeof profile !== 'object' || profile === null) continue
          const models = Array.isArray(profile.models) ? profile.models : []
          const explicitIds = models.length > 0 ? models.map((m) => m?.id).filter(Boolean) : []
          // A provider with no explicit models matches through the pi-ai
          // built-in catalog (same source as the official selector), and its
          // baseURL may come from the catalog entry (e.g. xiaomi configures
          // only an apiKeyEnv).
          const catalog = explicitIds.length === 0 ? catalogBuiltinModels(providerId) : null
          const catalogRows = Array.isArray(catalog) && catalog.length > 0 ? catalog : []
          const modelIds = explicitIds.length > 0 ? explicitIds : catalogRows.map((m) => m?.id).filter(Boolean)
          const baseURL = typeof profile.baseURL === 'string' && profile.baseURL.length > 0
            ? profile.baseURL
            : (catalogRows[0]?.baseUrl ?? '')
          if (typeof baseURL !== 'string' || baseURL.length === 0) continue
          const matched = modelIds.length > 0
            ? modelIds.some((modelId) => selected.has(`${providerId}/${modelId}`))
            : selected.has(providerId)
          if (matched) {
            const host = hostOf(baseURL)
            if (host) hosts.add(host)
          }
        }
      } else if (ns === 'llm-deepseek') {
        // Same built-in fallback as listModels / findTestTarget: an empty
        // `llm-deepseek: {}` still resolves to the official models + public
        // baseURL, so selecting a deepseek-official model proxies it too.
        const { models, baseURL } = deepSeekConnection(value)
        const modelIds = models.map((m) => m?.id).filter(Boolean)
        const matched = modelIds.length > 0
          ? modelIds.some((modelId) => selected.has(`${DEEPSEEK_OFFICIAL_PROVIDER_ID}/${modelId}`))
          : selected.has(DEEPSEEK_OFFICIAL_PROVIDER_ID)
        if (matched) {
          const host = hostOf(baseURL)
          if (host) hosts.add(host)
        }
      }
    }
  } catch (error) {
    logger?.warn('dsh-proxy: failed to resolve proxied-model hosts from settings')
    logger?.warn(error)
  }
  return [...hosts]
}

/**
 * Build a per-install dispatcher and log the effective routing summary.
 *
 * The config is funnelled through `plainProxyConfig` first: on dsh ≥ 0.1.7 the
 * loader hands over volatile *references* (`{ get(), [write] }`), so reading
 * `config.proxyPort` directly would install `[object Object]` as the endpoint.
 * Every install path (settings scope, patch fallback, no-inject host) shares
 * this one reader instead of each having to remember.
 */
function buildDispatcher(ctx, undici, settings, rawConfig, upstream = null) {
  const config = plainProxyConfig(rawConfig)
  const hosts = resolveProxyHosts(settings, config.proxiedModels, ctx.logger)
  const router = new RoutingDispatcher({
    undici,
    proxyHost: config.proxyHost,
    proxyPort: config.proxyPort,
    proxyHosts: hosts,
    // dsh ≥ 0.1.3 installs the official @deepseek-ai/dsh-http-proxy policy as
    // the global dispatcher at profile boot, before plugins load. Chaining to
    // that dispatcher for the DIRECT path keeps the deployment's own outbound
    // policy (HTTP_PROXY/HTTPS_PROXY, loopback-direct) in force for every host
    // this plugin does not pin to its proxy — instead of shadowing it with a
    // private Agent, which silently bypassed the host policy.
    directDispatcher: upstream,
    logger: ctx.logger,
  })
  // v2.0.0 direct failover: hosts the router keeps on the direct path get ONE
  // guarded replay through the failover proxy when the direct connection
  // fails at transport level (search, web fetch, domestic APIs — anything the
  // user did not pin to the proxy). The failover endpoint is the main proxy
  // by default, or `config.failoverProxy` when set.
  const failover = new FailoverDispatcher({
    undici,
    router,
    failoverEnabled: config.failoverEnabled !== false,
    failoverProxy: config.failoverProxy ?? '',
    negativeCacheTtlMs: config.negativeCacheTtlMs ?? 60000,
    directFailoverTimeoutMs: config.directFailoverTimeoutMs ?? 30000,
    logger: ctx.logger,
  })
  // Retry is handled by undici's official RetryAgent wrapping the failover
  // router: HTTP 429 / 5xx replay the request (LLM calls are POST, so the
  // default method list must be overridden to include it). Transport-level
  // error codes are deliberately narrow — ECONNRESET and socket errors that
  // happen mid-response (a reached server) — because CONNECT failures are
  // the failover layer's job; the error surfaces as-is instead of hammering
  // the same dead path with retries.
  const retry = new undici.RetryAgent(failover, {
    throwOnError: false,
    maxRetries: config.retries,
    minTimeout: config.retryIntervalMs,
    timeoutFactor: 1,
    maxTimeout: config.retryIntervalMs * 2,
    methods: ['POST', 'GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE', 'QUERY'],
    statusCodes: [429, 500, 502, 503, 504],
    errorCodes: ['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET'],
  })
  ctx.logger.info(
    `dsh-proxy: global dispatcher → RetryAgent(FailoverDispatcher(RoutingDispatcher)) ` +
      `(proxy=${config.proxyHost}:${config.proxyPort}, ` +
      `proxiedHosts=[${hosts.join(', ') || '(none)'}], ` +
      `retries=${config.retries}×${config.retryIntervalMs}ms, ` +
      `failover=${failover.failoverEnabled ? `on (${failover.fallbackKind})` : 'off'}, ` +
      `negCacheTtl=${failover.negativeCacheTtlMs}ms)`,
  )
  return retry
}

/**
 * Grace period for a retired dispatcher stack: `close()` lets in-flight
 * requests (LLM streams!) finish on the old agents; anything still stuck when
 * the grace expires is force-destroyed. 10 minutes comfortably exceeds normal
 * streaming completions while still reaping hung sockets.
 */
const RETIRE_GRACE_MS = 600_000

/**
 * Installer over the global dispatcher: keeps the pre-plugin dispatcher to
 * restore on teardown, swaps on every (re)apply, and retires the replaced
 * dispatcher gracefully. Exported for regression tests (the teardown-restore
 * and retirement semantics are the whole point of the 2.0.1 fixes).
 *
 * @param ctx - cordis context (logger only).
 * @param undici - the undici module.
 * @param [options]
 * @param [options.retireGraceMs] - force-destroy delay for retired stacks (tests shorten it).
 */
export function makeInstaller(ctx, undici, { retireGraceMs = RETIRE_GRACE_MS } = {}) {
  const { getGlobalDispatcher, setGlobalDispatcher } = undici
  let previous = null
  let current = null

  /** Graceful retirement of a replaced stack: close now, destroy after grace. */
  const retire = (dying) => {
    try {
      Promise.resolve(dying.close()).catch(() => {})
    } catch { /* already closing — the grace-period destroy reaps it */ }
    const timer = setTimeout(() => {
      try {
        Promise.resolve(dying.destroy()).catch(() => {})
      } catch { /* already destroyed */ }
    }, retireGraceMs)
    if (typeof timer.unref === 'function') timer.unref()
  }

  const install = (settings, config) => {
    // Capture the pre-plugin dispatcher BEFORE building the stack: the direct
    // path chains to it (see buildDispatcher), so it must be known first.
    // `setGlobalDispatcher` returns undefined (verified against undici 8.x),
    // so the capture is explicit — otherwise teardown leaves the global
    // dispatcher pointing at this plugin's destroyed stack and every later
    // fetch fails.
    if (previous === null) {
      previous = typeof getGlobalDispatcher === 'function' ? getGlobalDispatcher() : null
    }
    const next = buildDispatcher(ctx, undici, settings, config, previous)
    setGlobalDispatcher(next)
    const old = current
    current = next
    if (old !== null) retire(old)
  }

  const teardown = () => {
    if (previous !== null) {
      try { setGlobalDispatcher(previous) } catch { /* already gone */ }
      previous = null
    }
    const dying = current
    current = null
    // Dispose means the plugin goes away: cut connections immediately (the
    // host has its own dispatcher restored above; in-flight requests surface
    // as errors, matching a disabled/uninstalled plugin).
    if (dying !== null) dying.destroy().catch(() => {})
  }

  return { install, teardown }
}

export async function apply(ctx, config) {
  // Load the pi-ai built-in catalog before the first dispatcher install:
  // resolveProxyHosts reads it synchronously, so the proxied-host resolution
  // and the settings-bridge model list must see it from the first call on.
  // Never rejects (unavailable catalog → placeholder behaviour).
  await ensureCatalog()
  let undici
  try {
    undici = await import('undici')
  } catch (error) {
    ctx.logger.error('dsh-proxy: failed to load undici — proxy routing disabled')
    ctx.logger.error(error)
    return
  }
  if (typeof undici.setGlobalDispatcher !== 'function') {
    ctx.logger.error('dsh-proxy: undici does not expose setGlobalDispatcher — proxy routing disabled')
    return
  }

  const { install, teardown } = makeInstaller(ctx, undici)

  if (typeof ctx.inject === 'function') {
    // Settings-backed path: resolve the settings document, install the
    // resolved value, re-apply live on every committed change, and mount the
    // bridge routes so the Web settings page can read/write it and fetch the
    // model list.
    //
    // dsh ≥ 0.1.7 only. The settings document is this plugin's volatile Config,
    // addressed by the Loader entry id; the loader commits a write into the live
    // accessors in place and announces it as `loader/volatile-update` on this
    // fiber. The pre-0.1.7 `settings.register()`/`scope.watch()` seam no longer
    // exists on the host — and this release dropped support for that generation.
    ctx.inject(['settings'], (sctx) => {
      const seam = sctx.settings
      if (seam === undefined || seam === null || typeof seam.register === 'function') {
        ctx.logger.error(
          'dsh-proxy: unsupported DSH host — this release requires dsh >= 0.1.7 '
          + "(its settings service has no register(); the document is the plugin's volatile Config). "
          + 'Proxy routing stays disabled. For dsh <= 0.1.6 install @anpiluo/dsh-proxy@2.1.x.',
        )
        return
      }
      try {
        const readConfig = () => plainProxyConfig(config)
        const applyCurrent = () => {
          install(seam, readConfig())
          void syncRetryPolicy()
        }

        // Cold-start ordering: the llm-pi-ai / llm-deepseek namespaces are
        // registered by the official provider plugins, which inject the `llm`
        // service and therefore apply AFTER this plugin's settings callback on
        // a fresh start. The first install above would then resolve zero
        // proxied hosts, silently leaving every request on the direct path
        // until the user happened to save the settings page again. Two
        // compensations close that gap:
        //   1. Retry with backoff until both provider namespaces are
        //      registered, then install against the resolved model list.
        //   2. Re-install when either provider document changes at runtime
        //      (baseURL edits etc.), which `scope.watch` alone cannot see.
        const PROVIDER_NS = new Set(['llm-pi-ai', 'llm-deepseek'])
        const providerNames = () => {
          try {
            return new Set(seam.describe({ redactSecrets: true }).map((d) => String(d.ns)))
          } catch {
            return new Set()
          }
        }
        const providerReady = () => [...PROVIDER_NS].every((ns) => providerNames().has(ns))

        // --- retry-policy mirroring (v1.0.3) -------------------------------
        // The card's `retries` / `retryIntervalMs` drive the transport-layer
        // RetryAgent only; the official dsh-llm-retry plugin renders the visible
        // "(retry/maximum)" UI from each provider's own `retryPolicy` config.
        // Mirror the card values into the retryPolicy of every provider whose
        // model is selected in `proxiedModels`, so ONE configuration drives both
        // layers, and deselected models keep the official defaults untouched.
        const lastWritten = new Map() // `${ns}|${providerId}` -> mirrored retries
        const syncRetryPolicy = async () => {
          try {
            const cfg = readConfig()
            const { retries, retryIntervalMs } = cfg
            const selected = new Set(cfg.proxiedModels ?? [])
            const backoffInitial = Math.max(1, retryIntervalMs)
            const targets = []
            for (const d of seam.describe({ redactSecrets: true })) {
              const ns = String(d.ns)
              if (!PROVIDER_NS.has(ns)) continue
              const value = d.value
              if (typeof value !== 'object' || value === null) continue
              if (ns === 'llm-pi-ai') {
                const providers = (typeof value.providers === 'object' && value.providers !== null) ? value.providers : {}
                for (const [providerId, profile] of Object.entries(providers)) {
                  if (typeof profile !== 'object' || profile === null) continue
                  const models = Array.isArray(profile.models) ? profile.models : []
                  const explicitIds = models.length > 0 ? models.map((m) => m?.id).filter(Boolean) : []
                  const catalog = explicitIds.length === 0 ? catalogBuiltinModels(providerId) : null
                  const catalogRows = Array.isArray(catalog) && catalog.length > 0 ? catalog : []
                  const modelIds = explicitIds.length > 0 ? explicitIds : catalogRows.map((m) => m?.id).filter(Boolean)
                  const matched = modelIds.length > 0
                    ? modelIds.some((id) => selected.has(`${providerId}/${id}`))
                    : selected.has(providerId)
                  const rp = (typeof profile.retryPolicy === 'object' && profile.retryPolicy !== null) ? profile.retryPolicy : {}
                  const key = `llm-pi-ai|${providerId}`
                  const label = `llm-pi-ai.providers.${providerId}`
                  if (matched) {
                    if (rp.maxRetries !== retries || rp.backoff?.initialDelayMs !== backoffInitial) {
                      targets.push({ ns, label, key, retries, ops: [{ op: 'set', path: ['providers', providerId, 'retryPolicy'], value: { mode: 'normal', maxRetries: retries, backoff: { initialDelayMs: backoffInitial } } }] })
                    } else if (rp.maxRetries === retries) {
                      // Already mirrored (e.g. by a previous run): remember so
                      // deselecting the model can restore the official defaults.
                      lastWritten.set(key, retries)
                    }
                  } else if (lastWritten.get(key) !== undefined && rp.maxRetries === lastWritten.get(key)) {
                    targets.push({ ns, label, key, retries: undefined, ops: [{ op: 'unset', path: ['providers', providerId, 'retryPolicy'] }] })
                  }
                }
              } else {
                const modelIds = Array.isArray(value.models) ? value.models.map((m) => m?.id).filter(Boolean) : []
                const matched = modelIds.length > 0
                  ? modelIds.some((id) => selected.has(`deepseek-official/${id}`))
                  : selected.has('deepseek-official')
                const rp = (typeof value.retryPolicy === 'object' && value.retryPolicy !== null) ? value.retryPolicy : {}
                const key = 'llm-deepseek|deepseek-official'
                if (matched) {
                  if (rp.maxRetries !== retries || rp.backoff?.initialDelayMs !== backoffInitial) {
                    targets.push({ ns, label: 'llm-deepseek', key, retries, ops: [{ op: 'set', path: ['retryPolicy'], value: { mode: 'normal', maxRetries: retries, backoff: { initialDelayMs: backoffInitial } } }] })
                  } else if (rp.maxRetries === retries) {
                    lastWritten.set(key, retries)
                  }
                } else if (lastWritten.get(key) !== undefined && rp.maxRetries === lastWritten.get(key)) {
                  targets.push({ ns, label: 'llm-deepseek', key, retries: undefined, ops: [{ op: 'unset', path: ['retryPolicy'] }] })
                }
              }
            }
            for (const t of targets) {
              await seam.mutate(t.ns, t.ops)
              if (t.retries !== undefined) lastWritten.set(t.key, t.retries)
              else lastWritten.delete(t.key)
              ctx.logger.info(
                `dsh-proxy: mirrored retryPolicy ${t.retries !== undefined ? `maxRetries=${t.retries} initialDelayMs=${backoffInitial}` : '(official defaults)'} → ${t.label}`,
              )
            }
          } catch (error) {
            ctx.logger.warn('dsh-proxy: retryPolicy mirror failed: %o', error)
          }
        }
        const timers = []
        const scheduleRetry = (attempt) => {
          if (attempt > 8) return
          const timer = setTimeout(() => {
            if (providerReady()) {
              applyCurrent()
              return
            }
            scheduleRetry(attempt + 1)
          }, 100 * 2 ** attempt)
          timers.push(timer)
        }
        applyCurrent()
        if (!providerReady()) scheduleRetry(0)
        // Live apply: re-read the volatile accessors rather than trusting an
        // event payload, so values always resolve through one path.
        const disposeWatch = ctx.on('loader/volatile-update', () => {
          applyCurrent()
        })
        const disposeDoc = ctx.on('settings/document-updated', (ns) => {
          if (ns !== undefined && PROVIDER_NS.has(String(ns))) {
            applyCurrent()
          }
        })
        // Bridge routes need the webServer service, which may activate after
        // the settings seam; wait for both before mounting them.
        ctx.inject(['settings', 'webServer'], (bridgeCtx) => {
          const disposers = []
          // trustedOrigins is a getter so a live settings edit (reverse-proxy
          // deployment) widens the bridge trust check without a remount.
          for (const route of makeBridgeRoutes(bridgeCtx.settings, {
            trustedOrigins: () => plainProxyConfig(config).trustedOrigins,
          })) {
            disposers.push(bridgeCtx.webServer.register(route))
          }
          ctx.logger.info(
            'dsh-proxy: settings bridge mounted at /api/dsh-proxy/settings ' +
            `(${disposers.length} routes)`,
          )
          bridgeCtx.effect(() => () => {
            for (const dispose of disposers) dispose()
          })
        })
        ctx.logger.info(
          `dsh-proxy: settings document "${LLM_PROXY_ENTRY_ID}" served from the volatile Config `
          + '— live apply via 设置 → 插件 → 模型代理',
        )
        sctx.effect(() => () => {
          disposeWatch()
          disposeDoc()
          for (const timer of timers) clearTimeout(timer)
        })
      } catch (error) {
        ctx.logger.error('dsh-proxy: settings namespace registration failed — applying patch config directly')
        ctx.logger.error(error)
        install(seam, config)
      }
    })
  } else {
    // No cordis inject (fake contexts, plain config).
    install(undefined, config)
  }

  // Restore the previous dispatcher on teardown and close our agents.
  ctx.on('dispose', teardown)
}

export { LLM_PROXY_NAMESPACE, makeBridgeHandlers, makeBridgeRoutes, SETTINGS_BRIDGE_PREFIX } from './settings.js'
