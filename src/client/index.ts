/**
 * dsh-llm-proxy — browser half. Registers the 模型代理 plugin card inside
 * 设置 → 插件 → 可配置插件 via the `settings.plugin.item` slot (declared at
 * runtime by @deepseek-ai/dsh-client-ui-settings-plugins), whose card shows
 * the configurable proxy-model form. Data rides the llm-proxy settings scope,
 * which prefers the official settings transport and falls back to this
 * package's loopback bridge on hosts whose apiproxy does not expose the
 * namespace (rc.6 hard-coded allowlist; see README).
 *
 * Export discipline: cross-plugin collaboration goes through cordis services
 * (`slots`, `locale`, `settingsScope`, `remote`, `connection`); the bundle
 * purity gate forbids value imports of other @deepseek-ai packages.
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
import { LlmProxySettingsBinder } from './settings-scope.ts'
import type { ProxyModelScope } from './settings-scope.ts'
import { en, zh, type ProxyKey } from './locales.ts'

export type { ProxyModelCardInjected, ProxyModelCardProps } from './ProxyModelCard.tsx'
export type { ProxyKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 模型代理 card copy. */
    'settings.llm-proxy': ProxyKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.llm-proxy'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'settingsScope', 'remote']

/**
 * Register the 模型代理 plugin card once the `settings.plugin.item`
 * declaration is on the ledger, and bind the llm-proxy settings scope.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-llm-proxy: copy dictionaries')

  const binder = new LlmProxySettingsBinder(ctx)
  const scope: ProxyModelScope = binder.bind()
  const useSnapshot = (): ReturnType<ProxyModelScope['getSnapshot']> =>
    useSyncExternalStore(scope.subscribe, scope.getSnapshot)
  // Registration-time copy and the inject face share one bound translate;
  // copy freshness rides the locale revision.
  const t = ctx.locale.bind(NS) as ProxyModelCardInjected['t']
  const injected = (): ProxyModelCardInjected => ({ scope, useSnapshot, t })

  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'llm-proxy',
      // rc.7: keyed slots dispatch by namespace key (no list ordering).
      locale: NS,
      inject: injected,
    }, ProxyModelCard)
  })
}
