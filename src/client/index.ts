/**
 * dsh-proxy — browser half.
 *
 * The 模型代理 page is registered into whichever settings surface the host
 * provides, so one bundle serves every supported dsh generation:
 *   - dsh ≥ 0.1.7: the Plugins page's root list slot `plugins.item` (declared
 *     at runtime by @deepseek-ai/dsh-client-ui-plugin-manager), bound to the
 *     settings document derived from the plugin's volatile Config and
 *     addressed by its Loader entry id (`dsh-proxy`) through the official
 *     `configForms` service.
 *   - dsh 0.1.2–0.1.6: the 可配置插件 tab's keyed `settings.plugin.item` slot
 *     (declared by @deepseek-ai/dsh-client-ui-settings-plugins), bound to the
 *     registered `llm-proxy` namespace.
 * Both slots are declared at runtime, so injecting the one this host does not
 * have simply waits. A *hard* inject of a service the host dropped
 * (`settingsScope` on ≥ 0.1.7) is the trap: it leaves this fiber pending
 * forever and surfaces as a nameless boot failure. The settings service is
 * therefore resolved dynamically in settings-scope.ts, which falls back to
 * this package's loopback bridge when no official document is reachable.
 *
 * Export discipline: cross-plugin collaboration goes through cordis services
 * (`slots`, `locale`, `remote`); the bundle purity gate forbids value imports
 * of other @deepseek-ai packages.
 */
// ClientContext is the plain cordis Context in 0.1.2 (the pre-0.1.2
// '@deepseek-ai/dsh-client-runtime/client' type home no longer exists).
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { useSyncExternalStore } from 'react'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-settings-plugins SlotMap merge (the
// 'settings.plugin.item' entry the configurable tab declares at runtime).
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { ProxyModelCard } from './ProxyModelCard.tsx'
import type { ProxyModelCardInjected } from './ProxyModelCard.tsx'
import { LlmProxySettingsBinder, LLM_PROXY_ENTRY_ID, LLM_PROXY_NAMESPACE } from './settings-scope.ts'
import type { ProxyModelScope } from './settings-scope.ts'
import { en, zh, type ProxyKey } from './locales.ts'

export type { ProxyModelCardInjected, ProxyModelCardProps } from './ProxyModelCard.tsx'
export type { ProxyKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 模型代理 card copy. */
    'settings.llm-proxy': ProxyKey
  }
  interface SlotMap {
    /**
     * One configurable plugin page on dsh ≥ 0.1.7 (list slot, root scope),
     * declared at runtime by @deepseek-ai/dsh-client-ui-plugin-manager.
     * Declared here so this package compiles without that package installed:
     * the newer settings surface is reached through the `configForms` service,
     * not through its typings.
     */
    'plugins.item': { kind: 'list', scope: 'root' }
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.llm-proxy'

/**
 * Required services (cordis fiber inject): core UI services only. The settings
 * service is resolved dynamically, because its name changed between host
 * generations (`settingsScope` → `configForms` on dsh 0.1.7).
 */
export const inject = ['slots', 'locale']

/**
 * Register the 模型代理 page on every settings slot the host declares and bind
 * the plugin's settings document.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-proxy: copy dictionaries')

  const binder = new LlmProxySettingsBinder(ctx)
  // The scope is bound lazily, from the slot callbacks below rather than here.
  // `ctx.get()` returns undefined both when a service is missing *and* when its
  // provider fiber has not activated yet, so binding during apply() could pin
  // the session to the loopback bridge even on a host that does provide
  // `configForms`. A slot declaration is the first moment the package that
  // declares it is provably up, and it still precedes any render.
  let bound: ProxyModelScope | undefined
  const resolveScope = (): ProxyModelScope => (bound ??= binder.bind())
  const useSnapshot = (): ReturnType<ProxyModelScope['getSnapshot']> =>
    useSyncExternalStore(resolveScope().subscribe, resolveScope().getSnapshot)
  // Registration-time copy and the inject face share one bound translate;
  // copy freshness rides the locale revision.
  const t = ctx.locale.bind(NS) as ProxyModelCardInjected['t']
  const injected = (): ProxyModelCardInjected => ({ scope: resolveScope(), useSnapshot, t })

  // dsh ≤ 0.1.6: keyed slot. The key is the registered settings NAMESPACE
  // (`llm-proxy`), which is deliberately not the Loader entry id — rc.7
  // dispatches this slot by namespace key (no list ordering).
  ctx.slots.inject('settings.plugin.item', function* () {
    resolveScope()
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      key: LLM_PROXY_NAMESPACE,
      locale: NS,
      inject: injected,
    }, ProxyModelCard)
  })

  // dsh ≥ 0.1.7: root list slot, keyed by the Loader entry id the Host serves
  // the settings document under. `order` 50 keeps this third-party page after
  // the built-in ones (shell 10, agent-loop 20, subagent 30, web-search 40).
  ctx.slots.inject('plugins.item', function* () {
    resolveScope()
    yield ctx.slots.register({
      name: 'plugins.item',
      id: LLM_PROXY_ENTRY_ID,
      order: 50,
      label: () => t('title'),
      locale: NS,
      inject: injected,
    }, ProxyModelCard)
  })
}
