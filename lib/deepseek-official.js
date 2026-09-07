/**
 * dsh-proxy — llm-deepseek official built-in defaults.
 *
 * The host's `llm-deepseek` namespace (owned by @deepseek-ai/dsh-llm-deepseek)
 * resolves schema defaults for the model catalog and credential reference, but
 * its `baseURL` has no schema default: with an empty user document
 * (`llm-deepseek: {}`) the resolved settings snapshot still carries the
 * built-in models and apiKeyEnv, yet no baseURL. The official adapter then
 * falls back to its public endpoint at connection time.
 *
 * This module mirrors those official defaults so the proxy card's model list,
 * the per-model connection test and the proxied-host resolution all see the
 * same effective view the official selector shows — a model the UI can select
 * must be testable and routable.
 *
 * Defaults verified against @deepseek-ai/dsh-llm-deepseek@0.1.1-rc.2
 * (lib/index.js): DEFAULT_API_KEY_ENV, PROVIDER, DEFAULT_MODELS,
 * PUBLIC_BASE_URL, BASE_URL_ENV.
 */

/** The single provider route the llm-deepseek namespace owns. */
export const DEEPSEEK_OFFICIAL_PROVIDER_ID = 'deepseek-official'

/** Public DeepSeek endpoint used when no baseURL is configured. */
export const DEEPSEEK_OFFICIAL_DEFAULT_BASE_URL = 'https://api.deepseek.com'

/** Credential ref the official adapter reads when none is configured. */
export const DEEPSEEK_OFFICIAL_DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'

/** Environment variable naming the provider endpoint (trusted layers only). */
export const DEEPSEEK_OFFICIAL_BASE_URL_ENV = 'DEEPSEEK_BASE_URL'

/** Built-in model catalog (official DEFAULT_MODELS). */
export const DEEPSEEK_OFFICIAL_DEFAULT_MODELS = [
  { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
  {
    id: 'deepseek-v4-flash-vision-exp',
    name: 'DeepSeek-V4-Flash-Vision-Exp',
    inputModalities: ['text', 'image'],
  },
]

/**
 * Resolve the effective llm-deepseek connection view from a settings snapshot
 * value (which may be `{}`). Missing fields fall back to the official
 * built-in defaults, mirroring the adapter's own resolution.
 *
 * @param value - the `llm-deepseek` descriptor value.
 * @returns `{ models, baseURL, apiKeyEnv }`.
 */
export function deepSeekConnection(value) {
  const models = Array.isArray(value?.models) && value.models.length > 0
    ? value.models
    : DEEPSEEK_OFFICIAL_DEFAULT_MODELS
  const baseURL = typeof value?.baseURL === 'string' && value.baseURL.length > 0
    ? value.baseURL
    : DEEPSEEK_OFFICIAL_DEFAULT_BASE_URL
  const apiKeyEnv = typeof value?.apiKeyEnv === 'string' && value.apiKeyEnv.length > 0
    ? value.apiKeyEnv
    : DEEPSEEK_OFFICIAL_DEFAULT_API_KEY_ENV
  return { models, baseURL, apiKeyEnv }
}
