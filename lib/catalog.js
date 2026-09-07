/**
 * dsh-proxy — pi-ai built-in model catalog access.
 *
 * The proxy card's model selector must stay in sync with the official DSH
 * model list. The official selector resolves models through the llm adapter
 * (dsh-llm-pi-ai), which falls back to the installed pi-ai built-in catalog
 * (`@earendil-works/pi-ai`) whenever a provider profile declares no explicit
 * `models` — e.g. the `xiaomi` profile in settings.yaml carries only
 * `apiKeyEnv`, yet the official list shows all six MiMo models.
 *
 * This module mirrors that fallback: `listModels` / `resolveProxyHosts` /
 * `syncRetryPolicy` read the same catalog when a provider has no explicit
 * models, so the card's list and proxy matching agree with the official
 * selector. The catalog is loaded lazily (dynamic import) and the read is
 * synchronous after `ensureCatalog()` settles, keeping the existing sync
 * call paths unchanged; when pi-ai is unavailable the catalog reads as empty
 * and the previous placeholder behaviour is preserved.
 */
let loaded = null // { getBuiltinModels } once the catalog is available
let loading = null // in-flight import promise (dedupes concurrent calls)

/** Synchronous catalog read for one provider; null when not loaded yet. */
export function catalogBuiltinModels(providerId) {
  if (loaded === null) return null
  try {
    return loaded.getBuiltinModels(providerId)
  } catch {
    return []
  }
}

/**
 * Ensure the pi-ai built-in catalog is loaded. Idempotent and safe to call
 * from any async path; never rejects (an unavailable catalog degrades to the
 * placeholder behaviour). Callers that read synchronously afterwards must
 * await this first.
 */
export async function ensureCatalog() {
  if (loaded !== null || loading !== null) return loading ?? loaded
  loading = import('@earendil-works/pi-ai/providers/all')
    .then((mod) => {
      loaded = { getBuiltinModels: mod.getBuiltinModels }
      return loaded
    })
    .catch(() => {
      loaded = { getBuiltinModels: () => [] }
      return loaded
    })
    .finally(() => {
      loading = null
    })
  return loading
}

/**
 * Test hook: swap the catalog face. Pass a fake `getBuiltinModels(providerId)`
 * or null/undefined to simulate an unavailable pi-ai install.
 */
export function __setCatalogForTest(getBuiltinModels) {
  loaded = getBuiltinModels === null || getBuiltinModels === undefined
    ? { getBuiltinModels: () => [] }
    : { getBuiltinModels }
  loading = null
}

/** Test hook: reset module state between tests. */
export function __resetCatalogForTest() {
  loaded = null
  loading = null
}
