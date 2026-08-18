/**
 * @superfish058/dsh-llm-proxy v1.0.0 — per-model proxy routing + retry for DSH LLM requests,
 * configurable live from the DSH 设置 page (模型代理).
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
import { LLM_PROXY_NAMESPACE, makeBridgeRoutes } from './settings.js'

export const name = 'dsh-llm-proxy'

/**
 * Deployment configuration; every tunable is validated at load. The
 * pre-1.0.0 fields (proxyUrl, proxies, routes, defaultProxy, rateLimits,
 * maxQueueDepth) are intentionally gone.
 */
export const Config = Schema.object({
  /** Proxy hostname/IP; does not have to be this machine. */
  proxyHost: Schema.string().default('127.0.0.1'),
  /** Proxy port. */
  proxyPort: Schema.number().min(1).max(65535).step(1).default(7897),
  /**
   * Model keys whose baseURL hosts route through the proxy. Each entry is
   * `<providerId>/<modelId>` resolved against the configured model list
   * (llm-pi-ai + llm-deepseek); unknown keys are ignored with a warning.
   */
  proxiedModels: Schema.array(Schema.string()).default([]),
  /** Maximum retry attempts for a failed request (transport error / 429 / 5xx). */
  retries: Schema.number().min(0).max(10).step(1).default(3),
  /** Delay between retry attempts, in milliseconds. */
  retryIntervalMs: Schema.number().min(0).max(60000).step(1).default(1000),
})

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
          const baseURL = profile.baseURL
          if (typeof baseURL !== 'string' || baseURL.length === 0) continue
          const models = Array.isArray(profile.models) ? profile.models : []
          const modelIds = models.length > 0 ? models.map((m) => m?.id).filter(Boolean) : []
          const matched = modelIds.length > 0
            ? modelIds.some((modelId) => selected.has(`${providerId}/${modelId}`))
            : selected.has(providerId)
          if (matched) {
            const host = hostOf(baseURL)
            if (host) hosts.add(host)
          }
        }
      } else if (ns === 'llm-deepseek' && typeof value.baseURL === 'string') {
        const modelIds = Array.isArray(value.models) ? value.models.map((m) => m?.id).filter(Boolean) : []
        const matched = modelIds.length > 0
          ? modelIds.some((modelId) => selected.has(`deepseek-official/${modelId}`))
          : selected.has('deepseek-official')
        if (matched) {
          const host = hostOf(value.baseURL)
          if (host) hosts.add(host)
        }
      }
    }
  } catch (error) {
    logger?.warn('dsh-llm-proxy: failed to resolve proxied-model hosts from settings')
    logger?.warn(error)
  }
  return [...hosts]
}

/** Build a per-install dispatcher and log the effective routing summary. */
function buildDispatcher(ctx, undici, settings, config) {
  const hosts = resolveProxyHosts(settings, config.proxiedModels, ctx.logger)
  const router = new RoutingDispatcher({
    undici,
    proxyHost: config.proxyHost,
    proxyPort: config.proxyPort,
    proxyHosts: hosts,
    logger: ctx.logger,
  })
  // Retry is handled by undici's official RetryAgent wrapping the router:
  // transport errors, HTTP 429 and any 5xx replay the request (LLM calls are
  // POST, so the default method list must be overridden to include it).
  const retry = new undici.RetryAgent(router, {
    throwOnError: false,
    maxRetries: config.retries,
    minTimeout: config.retryIntervalMs,
    timeoutFactor: 1,
    maxTimeout: config.retryIntervalMs * 2,
    methods: ['POST', 'GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE', 'QUERY'],
    statusCodes: [429, 500, 502, 503, 504],
    errorCodes: ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ENETDOWN', 'ENETUNREACH', 'EHOSTDOWN', 'EHOSTUNREACH', 'EPIPE', 'UND_ERR_SOCKET'],
  })
  ctx.logger.info(
    `dsh-llm-proxy: global dispatcher → RetryAgent(RoutingDispatcher) ` +
      `(proxy=${config.proxyHost}:${config.proxyPort}, ` +
      `proxiedHosts=[${hosts.join(', ') || '(none)'}], ` +
      `retries=${config.retries}×${config.retryIntervalMs}ms)`,
  )
  return retry
}

/**
 * Installer over the global dispatcher: keeps the pre-plugin dispatcher to
 * restore on teardown, swaps on every (re)apply, and closes agents of the
 * dispatcher being replaced.
 */
function makeInstaller(ctx, undici) {
  const { setGlobalDispatcher } = undici
  let previous = null
  let current = null

  const install = (settings, config) => {
    const next = buildDispatcher(ctx, undici, settings, config)
    if (previous === null) previous = setGlobalDispatcher(next)
    else setGlobalDispatcher(next)
    const old = current
    current = next
    if (old !== null) old.destroy().catch(() => {})
  }

  const teardown = () => {
    if (previous !== null) {
      try { setGlobalDispatcher(previous) } catch { /* already gone */ }
      previous = null
    }
    const dying = current
    current = null
    if (dying !== null) dying.destroy().catch(() => {})
  }

  return { install, teardown }
}

export async function apply(ctx, config) {
  let undici
  try {
    undici = await import('undici')
  } catch (error) {
    ctx.logger.error('dsh-llm-proxy: failed to load undici — proxy routing disabled')
    ctx.logger.error(error)
    return
  }
  if (typeof undici.setGlobalDispatcher !== 'function') {
    ctx.logger.error('dsh-llm-proxy: undici does not expose setGlobalDispatcher — proxy routing disabled')
    return
  }

  const { install, teardown } = makeInstaller(ctx, undici)

  if (typeof ctx.inject === 'function') {
    // Settings-backed path: register the namespace, install the resolved
    // value, re-apply live on every committed change, and mount the bridge
    // routes so the Web settings page can read/write the namespace and fetch
    // the model list.
    ctx.inject(['settings'], (sctx) => {
      const seam = sctx.settings
      if (!seam || typeof seam.register !== 'function') {
        ctx.logger.warn('dsh-llm-proxy: settings seam unavailable — applying patch config directly')
        install(seam, config)
        return
      }
      try {
        const scope = seam.register(LLM_PROXY_NAMESPACE, Config, { base: config, applies: 'live' })
        install(seam, scope.get())
        const disposeWatch = scope.watch((next) => {
          install(seam, next)
        })
        // Bridge routes need the webServer service, which may activate after
        // the settings seam; wait for both before mounting them.
        ctx.inject(['settings', 'webServer'], (bridgeCtx) => {
          const disposers = []
          for (const route of makeBridgeRoutes(bridgeCtx.settings)) {
            disposers.push(bridgeCtx.webServer.register(route))
          }
          ctx.logger.info(
            'dsh-llm-proxy: settings bridge mounted at /api/dsh-llm-proxy/settings ' +
            `(${disposers.length} routes)`,
          )
          bridgeCtx.effect(() => () => {
            for (const dispose of disposers) dispose()
          })
        })
        ctx.logger.info('dsh-llm-proxy: settings namespace "llm-proxy" registered — live apply via 设置 → 模型代理')
        sctx.effect(() => () => {
          disposeWatch()
        })
      } catch (error) {
        ctx.logger.error('dsh-llm-proxy: settings namespace registration failed — applying patch config directly')
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
