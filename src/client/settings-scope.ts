/**
 * rc.6-compatible settings scope for dsh-proxy.
 *
 * rc.6 host-apiproxy serves only a hard-coded namespace allowlist, so the
 * official settings scope answers "unavailable" for the `llm-proxy`
 * namespace. This binder wraps the official scope: when it reports the
 * namespace ready the wrapper is a pass-through; when it reports
 * unavailable, a same-origin bridge controller takes over and serves the
 * same SettingsScope contract from this package's host-side bridge routes
 * (/api/dsh-proxy/settings). The Host keeps the bridge loopback-only.
 */
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
// Snapshot-store engine: the host web bundle seeds it as the
// '@deepseek-ai/dsh-client-store' module (DSH ≥ 0.1.2-rc.1; the pre-0.1.2
// id '@deepseek-ai/dsh-client-runtime/client' no longer exists on the
// module table). The npm package's exports map has no ./client subpath —
// the bare specifier is BOTH the build external and the runtime seed id.
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Settings namespace owned by the plugin (mirrors lib/settings.js). */
export const LLM_PROXY_NAMESPACE = 'llm-proxy'

/**
 * Cordis Loader entry id the plugin is composed under (mirrors
 * `LLM_PROXY_ENTRY_ID` in lib/index.js).
 *
 * dsh ≥ 0.1.7 addresses a plugin's settings document by this id instead of by
 * a registered namespace, so the `configForms` path asks for it while the
 * bridge and the pre-0.1.7 binder keep using `LLM_PROXY_NAMESPACE`.
 */
export const LLM_PROXY_ENTRY_ID = 'dsh-proxy'

/** Bridge route prefix (same-origin, loopback-only). */
const SETTINGS_BRIDGE_PREFIX = '/api/dsh-proxy/settings'

/** The snapshot shape the proxy-model section consumes. */
export interface ProxyModelSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value?: unknown
  base?: unknown
  user?: unknown
  revision?: number
  writable: boolean
}

/** The store state (snapshot plus the persistence-mode marker). */
interface StoreState extends ProxyModelSnapshot {
  mode: 'host' | 'memory'
}

/** One field write (path op over the namespace user section). */
export interface FieldWrite {
  field: string
  op: 'set' | 'unset'
  value?: unknown
}

/** One selectable model row (host bridge `/models`). */
export interface ProxyModelRow {
  key: string
  providerId: string
  modelId: string
  name: string
  providerLabel: string
  host: string
  inputModalities: string[]
}

/** One connection-test outcome (host bridge `/test`). */
export interface TestResult {
  key: string
  ok: boolean
  status?: number
  latencyMs?: number
  viaProxy?: boolean
  multimodal?: boolean
  code?: string
  message?: string
}

/** The scope face the proxy-model section consumes. */
export interface ProxyModelScope {
  getSnapshot(): ProxyModelSnapshot
  subscribe(listener: () => void): () => void
  /** Queue a Host refresh. */
  load(): Promise<void>
  /** Write every staged field in one batch (batch validation on the bridge). */
  mutate(fields: FieldWrite[]): Promise<{ ok: boolean; code?: string; message?: string }>
  /** Fetch the selectable model list from the host bridge. */
  listModels(): Promise<ProxyModelRow[]>
  /** Probe one model key from the host (rides the proxy routing + retry). */
  test(key: string): Promise<TestResult>
  /** Stop queued operations and wait for the current call to settle. */
  dispose(): Promise<void>
}

/** One bridge RPC result envelope. */
interface BridgeResult {
  ok: boolean
  value?: unknown
  code?: string
  message?: string
}

/** The view the bridge serves for one namespace. */
interface BridgeView {
  ns: string
  schema: unknown
  value: unknown
  base?: unknown
  user?: unknown
  secrets?: Array<{ path: string[]; set: boolean }>
  revision?: number
}

/** True when the value is a well-formed bridge RPC result. */
function isBridgeResult(value: unknown): value is BridgeResult {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.ok !== 'boolean') return false
  if (record.ok) return typeof record.value === 'object' && record.value !== null
  return typeof record.code === 'string' && typeof record.message === 'string'
}

/** Build the fetch-backed settings face for the bridge routes. */
function createBridgeApi(fetchFn: typeof fetch) {
  const post = async (path: string, body: unknown): Promise<BridgeResult> => {
    try {
      const response = await fetchFn(SETTINGS_BRIDGE_PREFIX + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) return { ok: false, code: 'internal', message: 'bridge HTTP ' + response.status }
      const parsed: unknown = await response.json()
      if (!isBridgeResult(parsed)) return { ok: false, code: 'internal', message: 'bridge malformed response' }
      return parsed
    } catch {
      return { ok: false, code: 'internal', message: 'settings bridge unreachable' }
    }
  }
  return {
    describe: (): Promise<BridgeResult> => post('/describe', {}),
    mutate: (payload: unknown): Promise<BridgeResult> => post('/mutate', payload),
    models: async (): Promise<ProxyModelRow[]> => {
      const result = await post('/models', {})
      if (!result.ok || typeof result.value !== 'object' || result.value === null) return []
      const value = result.value as { models?: unknown }
      if (!Array.isArray(value.models)) return []
      return value.models.filter(isModelRow)
    },
    test: async (key: string): Promise<TestResult> => {
      const result = await post('/test', { key })
      if (!result.ok || typeof result.value !== 'object' || result.value === null) {
        return { key, ok: false, code: result.code ?? 'internal', message: result.message ?? 'test failed' }
      }
      return result.value as TestResult
    },
  }
}

/** Type guard for a bridge model row. */
function isModelRow(row: unknown): row is ProxyModelRow {
  if (typeof row !== 'object' || row === null) return false
  const record = row as Record<string, unknown>
  return typeof record.key === 'string'
    && typeof record.name === 'string'
    && typeof record.providerLabel === 'string'
    && typeof record.host === 'string'
}

/**
 * A minimal SettingsScopeController over the bridge face, mirroring the
 * official controller's ordering (serialized queue, revision-fenced writes,
 * recovery read after a refusal).
 */
class BridgeScopeController implements ProxyModelScope {
  private readonly api: ReturnType<typeof createBridgeApi>
  private readonly store: ReturnType<typeof createSnapshotStore<StoreState>>
  private tail: Promise<void> = Promise.resolve()
  private disposed = false

  constructor(fetchFn: typeof fetch) {
    this.api = createBridgeApi(fetchFn)
    this.store = createSnapshotStore<StoreState>({
      status: 'loading',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
      mode: 'host',
    })
  }

  getSnapshot(): ProxyModelSnapshot {
    return this.store.getSnapshot() as ProxyModelSnapshot
  }

  subscribe(listener: () => void) {
    return this.store.subscribe(listener)
  }

  /** Queue a Host refresh through the bridge. */
  load() {
    return this.enqueue(() => this.read())
  }

  mutate(fields: FieldWrite[]) {
    return this.enqueue(() => this.writeBatch(fields))
  }

  listModels() {
    return this.api.models()
  }

  test(key: string) {
    return this.enqueue(() => this.api.test(key))
  }

  async dispose() {
    this.disposed = true
    await this.tail
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.resolve(undefined as T)
    const task = this.tail.then(async () => {
      if (this.disposed) return undefined as T
      return operation()
    })
    this.tail = task.then(() => undefined, () => undefined)
    return task
  }

  private async read() {
    let response: BridgeResult
    try {
      response = await this.api.describe()
    } catch {
      if (!this.disposed) this.markUnavailable()
      return
    }
    if (!response.ok || this.disposed) {
      if (!this.disposed) this.markUnavailable()
      return
    }
    const value = response.value as { namespaces?: BridgeView[]; writable?: boolean }
    const view = (value.namespaces ?? []).find((candidate) => candidate.ns === LLM_PROXY_NAMESPACE)
    if (view === undefined) {
      this.store.update((draft) => {
        draft.status = 'unavailable'
        draft.writable = value.writable !== false
      })
      return
    }
    this.accept(view, value.writable !== false)
  }

  private async writeBatch(fields: FieldWrite[]) {
    const revision = this.getSnapshot().revision
    const ops = fields.map(({ field, op, value }) => (
      op === 'set' ? { op, path: [field], value } : { op, path: [field] }
    ))
    let response: BridgeResult
    try {
      response = await this.api.mutate({
        ns: LLM_PROXY_NAMESPACE,
        ops,
        ...(revision === undefined ? {} : { expectedRevision: revision }),
      })
    } catch {
      await this.read()
      return { ok: false, code: 'internal', message: 'settings bridge unreachable' }
    }
    if (!response.ok || this.disposed) {
      const refusal = response.ok === false
        ? response
        : { ok: false, code: 'internal', message: 'settings bridge unreachable' }
      await this.read()
      return { ok: false, code: refusal.code, message: refusal.message }
    }
    this.accept(response.value as BridgeView, this.getSnapshot().writable)
    return { ok: true }
  }

  private accept(view: BridgeView, writable: boolean) {
    this.store.update((draft) => {
      draft.revision = view.revision
      draft.base = view.base
      draft.user = view.user
      draft.writable = writable
      if (view.value === undefined || view.value === null) return
      draft.status = 'ready'
      draft.value = view.value
    })
  }

  private markUnavailable() {
    this.store.update((draft) => {
      draft.status = 'unavailable'
    })
  }
}

/** The official scope face (a subset of the runtime SettingsScope contract). */
interface OfficialScopeFace {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
  load(): Promise<void>
  dispose(): Promise<void>
}

/** Normalize any scope snapshot into the shared snapshot shape. */
function snapshotOf(snapshot: unknown): ProxyModelSnapshot {
  return snapshot as ProxyModelSnapshot
}

/** Wrap the official settings scope with the bridge fallback. */
function createCompatScope(primary: OfficialScopeFace, fetchFn: typeof fetch): ProxyModelScope {
  const fallback = new BridgeScopeController(fetchFn)
  const store = createSnapshotStore<StoreState>({
    status: 'loading',
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    writable: false,
    mode: 'host',
  })
  let fallbackStarted = false

  const project = (): ProxyModelSnapshot => {
    const primarySnapshot = snapshotOf(primary.getSnapshot())
    // The official scope is authoritative when it has settled to ready.
    if (primarySnapshot.status === 'ready') return primarySnapshot
    // Otherwise prefer a settled bridge — the official scope can legitimately
    // stay 'loading' forever (its describe mirror never folds a view for this
    // namespace), so a ready bridge must not be masked by a loading primary.
    const bridgeSnapshot = fallback.getSnapshot()
    if (bridgeSnapshot.status === 'ready') return bridgeSnapshot
    // Neither settled: surface loading while either is still loading so the
    // card never flashes a stale value.
    if (primarySnapshot.status === 'loading' || bridgeSnapshot.status === 'loading') {
      return { ...primarySnapshot, status: 'loading' }
    }
    return primarySnapshot
  }

  const publish = () => {
    store.set({ ...project(), mode: 'host' })
  }

  const startFallback = () => {
    if (fallbackStarted) return
    fallbackStarted = true
    void fallback.load()
  }

  const unsubscribes = [
    primary.subscribe(() => {
      publish()
      // The official scope is the preferred path only while it reports ready.
      // Anything else (loading / unavailable) means we cannot rely on it —
      // start the bridge fallback so the card can settle, rather than hanging
      // on a primary that never flips off 'loading'.
      if (snapshotOf(primary.getSnapshot()).status !== 'ready') startFallback()
    }),
    fallback.subscribe(publish),
  ]
  // Kick the fallback off whenever the official scope is not already ready:
  // the card must not hang on a primary stuck 'loading' (e.g. a describe
  // mirror that never settles). The bridge is a cheap same-origin read, and
  // once both are ready the composite prefers the official value.
  if (snapshotOf(primary.getSnapshot()).status !== 'ready') startFallback()
  // Seed the composite store from the current state (useSyncExternalStore
  // reads it directly); without this the store can sit on its initial
  // 'loading' until the primary emits a change.
  publish()

  const active = (): OfficialScopeFace | BridgeScopeController => {
    // The official scope is the write path ONLY while it reports ready.
    // Once it settles unavailable (every non-allowlisted rc.6 namespace), it
    // must never be written again: an official set() on an undeclared
    // namespace resolves without persisting — the "fake save". The bridge is
    // authoritative for every other state; mutate() below loads it first when
    // it has not settled yet.
    if (snapshotOf(primary.getSnapshot()).status === 'ready') return primary
    return fallback
  }

  return {
    getSnapshot: () => store.getSnapshot() as ProxyModelSnapshot,
    subscribe: (listener) => store.subscribe(listener),
    load: async () => {
      fallbackStarted = true
      await fallback.load()
    },
    listModels: () => fallback.listModels(),
    test: (key: string) => fallback.test(key),
    mutate: async (fields) => {
      const backend = active()
      if (backend === fallback) {
        // Bridge not settled yet: read once first so the write runs against a
        // known revision instead of a blind one, then write through the bridge
        // no matter what primary reported.
        if (fallback.getSnapshot().status !== 'ready') await fallback.load()
        return fallback.mutate(fields)
      }
      // Official backend: write field by field (it has no batch seam).
      const official = backend as OfficialScopeFace
      let firstFailure: { ok: false; code?: string; message?: string } | undefined
      for (const { field, op, value } of fields) {
        try {
          if (op === 'set') await official.set(field, value)
          else await official.unset(field)
        } catch {
          firstFailure ??= { ok: false, code: 'internal', message: 'settings write failed' }
        }
      }
      return firstFailure ?? { ok: true }
    },
    dispose: async () => {
      for (const unsubscribe of unsubscribes.splice(0)) unsubscribe()
      await fallback.dispose()
      await primary.dispose()
    },
  }
}

/** True when the value exposes the official settings binder's bind() seam. */
function isBinderFace(value: unknown): value is { bind(spec: { namespace: string }): OfficialScopeFace } {
  return typeof value === 'object' && value !== null && typeof (value as { bind?: unknown }).bind === 'function'
}

/**
 * The per-entry form dsh ≥ 0.1.7's `configForms` service returns.
 *
 * Its snapshot is the same shape this card already consumes
 * (`status`/`value`/`base`/`user`/`revision`/`writable`), and its `set`/`unset`
 * resolve `false` on a Host refusal (revision conflict, unwritable document)
 * instead of rejecting.
 */
export interface ConfigFormFace {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
  dispose(): Promise<void> | void
}

/** The `configForms` service surface this plugin consumes. */
export interface ConfigFormsSurface {
  /** The form of one Host plugin entry id. */
  get(entryId: string): ConfigFormFace
}

/**
 * Reach the `configForms` service on a context, or undefined when this host
 * does not provide it (dsh ≤ 0.1.6 — the caller stays inert instead of failing
 * its own fiber).
 * @param ctx - any context carrying the service.
 */
export function configFormsOf(ctx: Context): ConfigFormsSurface | undefined {
  const service = ctx.get('configForms') as unknown
  if (typeof service !== 'object' || service === null) return undefined
  const get = (service as { get?: unknown }).get
  if (typeof get !== 'function') return undefined
  return service as ConfigFormsSurface
}

/**
 * Project the 0.1.7+ form onto the official scope face the compat scope
 * already understands, so one composite (official primary + bridge fallback)
 * serves both host generations.
 *
 * The controller keeps itself fresh by subscribing to the Host mirror, so
 * `load()` is a no-op; a refusal (`false`) is raised as an error so the
 * caller's batch write reports it instead of a false success.
 * @param form - the entry form from `configForms.get()`.
 */
function officialFaceOf(form: ConfigFormFace): OfficialScopeFace {
  return {
    getSnapshot: () => form.getSnapshot(),
    subscribe: (listener) => form.subscribe(listener),
    set: async (field, value) => {
      if (await form.set(field, value) === false) throw new Error('dsh-proxy: settings write refused')
    },
    unset: async (field) => {
      if (await form.unset(field) === false) throw new Error('dsh-proxy: settings write refused')
    },
    load: async () => { /* the Host mirror pushes updates into the form */ },
    dispose: async () => { await form.dispose() },
  }
}

/**
 * The settings binder, provided as the `llmProxySettings` service.
 *
 * Three host generations are covered by one scope face:
 *   - dsh ≥ 0.1.7: `configForms.get(entryId)` — the document derived from the
 *     plugin's volatile Config, addressed by the Loader entry id.
 *   - dsh 0.1.2–0.1.6: `settingsScope.bind({ namespace })`.
 *   - any host whose official document never settles (rc.6 namespace
 *     allowlist, unreachable document): the loopback bridge.
 * The official document always wins while it reports ready, so the Host stays
 * the authority and the bridge is only ever a stand-in.
 */
export class LlmProxySettingsBinder extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llmProxySettings')
  }

  bind(): ProxyModelScope {
    const ctx = this.ctx
    const bridge = (): ProxyModelScope => new BridgeScopeController((input, init) => fetch(input, init))

    const forms = configFormsOf(ctx)
    let primary: OfficialScopeFace | undefined
    let documentKey = LLM_PROXY_NAMESPACE
    if (forms !== undefined) {
      primary = officialFaceOf(forms.get(LLM_PROXY_ENTRY_ID))
      documentKey = LLM_PROXY_ENTRY_ID
    } else {
      const official = ctx.get('settingsScope') as unknown
      if (isBinderFace(official)) primary = official.bind({ namespace: LLM_PROXY_NAMESPACE })
    }

    // No official document at all: stay on the bridge instead of throwing.
    // Throwing here would abort this plugin's apply() and take the whole
    // client plugin down (dsh ≥ 0.1.7 no longer provides `settingsScope`).
    const scope = primary === undefined
      ? bridge()
      : createCompatScope(primary, (input, init) => fetch(input, init))
    ctx.effect(() => {
      const remote = ctx.get('remote') as { $on?: (event: string, listener: (ns?: string) => void) => () => void } | undefined
      const disposers: Array<() => void> = []
      if (remote !== undefined && typeof remote.$on === 'function') {
        disposers.push(remote.$on('settings/document-updated', (namespace) => {
          if (namespace !== undefined && namespace !== documentKey) return
          void scope.load()
        }))
      }
      disposers.push(ctx.on('connection/reset', () => {
        void scope.load()
      }))
      return () => {
        for (const dispose of disposers) dispose()
        void scope.dispose()
      }
    }, 'dsh-proxy: compat scope invalidation')
    return scope
  }
}
