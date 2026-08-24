/**
 * dsh-llm-proxy v1.0.9 — multimodal mirroring tests.
 *
 * The card's independent 多模态模型 section lists models to advertise as
 * accepting image input. DSH refuses image-bearing requests unless the owning
 * provider namespace declares the modality (llm-pi-ai: `models[].input`,
 * llm-deepseek: `models[].inputModalities`). The mirror must write `[text,
 * image]` for exactly the selected models and restore the official defaults
 * when a model is deselected — for explicit-model providers, catalog-backed
 * providers (via modelOverrides) and the deepseek-official route alike.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, Config } from '../lib/index.js'
import { __resetCatalogForTest, __setCatalogForTest } from '../lib/catalog.js'

/** Flush pending microtasks/macrotasks so fire-and-forget async settles. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** llm-pi-ai namespace view: one selected model provider + one bystander. */
const PI_AI_VALUE = {
  providers: {
    'deepseek-v4-flash': {
      displayName: 'deepseek-v4-flash（B.AI）',
      baseURL: 'https://api.b.ai/v1',
      models: [
        { id: 'deepseek-v4-flash' },
        { id: 'deepseek-v4-flash-vision-exp' },
      ],
    },
    xiaomi: {
      displayName: 'xiaomi',
      baseURL: 'https://api.xiaomimimo.com/v1',
      models: [{ id: 'mimo-v2.5' }],
    },
  },
}

/** llm-deepseek namespace view with a text-only default model. */
const DEEPSEEK_VALUE = {
  models: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', inputModalities: ['text'] },
  ],
}

/**
 * Fake seam accepting cross-namespace mutate on llm-pi-ai / llm-deepseek
 * (as the real dsh-settings seam does). Provider-layer edits are reflected
 * into describe()'s `value`; `user` carries the base seed so the mirror
 * reads user-written entries only (schema defaults never leak in).
 */
function makeMirrorSeam({ base, withDeepseek = false, seed }) {
  const piBase = structuredClone(seed ?? PI_AI_VALUE)
  const deepseekBase = structuredClone(DEEPSEEK_VALUE)
  const proxyUser = {}
  const piUser = {}
  const deepseekUser = {}
  const watchers = new Set()
  const registered = new Set()
  const resolvePi = () => {
    const value = structuredClone(piBase)
    for (const [pid, patch] of Object.entries(piUser)) {
      if (Array.isArray(patch.models)) {
        value.providers[pid] = { ...(value.providers[pid] ?? {}), ...patch, models: patch.models }
      } else {
        value.providers[pid] = { ...(value.providers[pid] ?? {}), ...patch }
      }
    }
    return value
  }
  const resolveDeepseek = () => {
    const value = structuredClone(deepseekBase)
    if (Array.isArray(deepseekUser.models)) value.models = deepseekUser.models
    return value
  }
  /** User-layer view: the base seed plus every piUser patch (mirror read seam). */
  const resolvePiUser = () => {
    const user = structuredClone(piBase)
    for (const [pid, patch] of Object.entries(piUser)) {
      if (Array.isArray(patch.models)) {
        user.providers[pid] = { ...(user.providers[pid] ?? {}), ...patch, models: patch.models }
      } else {
        user.providers[pid] = { ...(user.providers[pid] ?? {}), ...patch }
      }
    }
    return user
  }
  /** User-layer view for llm-deepseek. */
  const resolveDeepseekUser = () => {
    const user = structuredClone(deepseekBase)
    if (Array.isArray(deepseekUser.models)) user.models = deepseekUser.models
    return user
  }
  const seam = {
    writable: true,
    documentPath: 'fake-settings.yaml',
    register(ns) {
      registered.add(String(ns))
      return {
        get: () => ({ ...base, ...proxyUser }),
        watch(callback) {
          watchers.add(callback)
          return () => watchers.delete(callback)
        },
        update() { throw new Error('not used') },
        replace() { throw new Error('not used') },
      }
    },
    describe() {
      const rows = [
        { ns: 'llm-proxy', schema: {}, value: { ...base, ...proxyUser } },
        { ns: 'llm-pi-ai', schema: {}, value: resolvePi(), user: resolvePiUser() },
      ]
      if (withDeepseek) rows.push({
        ns: 'llm-deepseek',
        schema: {},
        value: resolveDeepseek(),
        user: resolveDeepseekUser(),
      })
      return rows
    },
    async mutate(ns, ops) {
      const nsName = String(ns)
      if (nsName === 'llm-proxy') {
        for (const op of ops) {
          const [field] = op.path
          if (op.op === 'set') proxyUser[field] = op.value
          else delete proxyUser[field]
        }
        const next = { ...base, ...proxyUser }
        for (const callback of watchers) void callback(next)
        return
      }
      if (nsName === 'llm-pi-ai') {
        for (const op of ops) {
          const [, providerId, kind, ...rest] = op.path
          if (kind === 'models') {
            // providers.<id>.models[<index>].input (wholesale replacement)
            const field = rest[rest.length - 1]
            const provider = piUser[providerId] ?? {}
            const models = structuredClone(resolvePi().providers[providerId]?.models ?? [])
            for (const entry of op.value) {
              const index = models.findIndex((m) => m?.id === entry?.id)
              if (index === -1) models.push(entry)
              else models[index] = entry
            }
            piUser[providerId] = { ...provider, models }
          } else {
            // providers.<id>.modelOverrides.<modelId>.input
            const modelId = rest[0]
            const field = rest[rest.length - 1]
            const provider = piUser[providerId] ?? {}
            const overrides = { ...(provider.modelOverrides ?? {}) }
            const entry = { ...(overrides[modelId] ?? {}) }
            if (op.op === 'set') entry[field] = op.value
            else delete entry[field]
            overrides[modelId] = entry
            piUser[providerId] = { ...provider, modelOverrides: overrides }
          }
        }
        return
      }
      assert.equal(nsName, 'llm-deepseek')
      for (const op of ops) {
        // models — wholesale array replacement (array-index paths are unsafe)
        if (op.op === 'set') deepseekUser.models = structuredClone(op.value)
      }
    },
  }
  return { seam, getPi: resolvePi, getDeepseek: resolveDeepseek, state: { registered } }
}

/** Minimal cordis ctx: inject resolves settings (+ webServer for bridge routes). */
function makeCtx({ seam }) {
  const calls = []
  const ctx = {
    logger: {
      info: (m) => calls.push(['info', m]),
      warn: (m) => calls.push(['warn', m]),
      error: (m) => calls.push(['error', m]),
    },
    on: () => () => {},
    inject(services, callback) {
      const sctx = { effect: () => {} }
      for (const service of services) {
        if (service === 'settings') sctx.settings = seam
        if (service === 'webServer') sctx.webServer = { register: (route) => calls.push(['route', route.path]) }
      }
      callback(sctx)
    },
  }
  return { ctx, calls }
}

test('mirror writes [text, image] input for selected models only (pi-ai explicit)', async () => {
  const base = Config({
    multimodalModels: ['deepseek-v4-flash/deepseek-v4-flash'],
  })
  const { seam, getPi } = makeMirrorSeam({ base })
  const { ctx } = makeCtx({ seam })
  await apply(ctx, base)
  await tick()
  await tick()

  const pi = getPi()
  const selected = pi.providers['deepseek-v4-flash'].models[0]
  assert.deepEqual(selected.input, ['text', 'image'], 'selected model advertises image input')
  assert.equal(pi.providers['deepseek-v4-flash'].models[1].input, undefined, 'unselected model untouched')
  assert.equal(pi.providers.xiaomi.models[0].input, undefined, 'bystander provider untouched')
})

test('mirror writes modelOverrides for catalog-backed providers', async () => {
  __setCatalogForTest((providerId) => (providerId === 'xiaomi' ? [
    { id: 'mimo-v2.5', name: 'MiMo-V2.5', baseUrl: 'https://api.xiaomimimo.com/v1' },
  ] : []))
  try {
    const base = Config({
      multimodalModels: ['xiaomi/mimo-v2.5'],
    })
    const seam = {
      writable: true,
      documentPath: 'fake-settings.yaml',
      register() {
        return {
          get: () => base,
          watch() { return () => {} },
          update() { throw new Error('not used') },
          replace() { throw new Error('not used') },
        }
      },
      describe() {
        return [
          { ns: 'llm-proxy', schema: {}, value: base },
          { ns: 'llm-pi-ai', schema: {}, value: {
            providers: { xiaomi: { apiKeyEnv: 'XIAOMI_API_KEY' } },
          }, user: {
            providers: { xiaomi: { apiKeyEnv: 'XIAOMI_API_KEY' } },
          } },
        ]
      },
      async mutate(ns, ops) {
        assert.equal(String(ns), 'llm-pi-ai')
        for (const op of ops) {
          const [, providerId, kind, modelId, field] = op.path
          assert.equal(kind, 'modelOverrides')
          assert.equal(providerId, 'xiaomi')
          assert.equal(modelId, 'mimo-v2.5')
          assert.equal(field, 'input')
          if (op.op === 'set') {
            assert.deepEqual(op.value, ['text', 'image'])
          } else {
            assert.fail('deselect path not expected here')
          }
        }
      },
    }
    const { ctx } = makeCtx({ seam })
    await apply(ctx, base)
    await tick()
    await tick()
  } finally {
    __resetCatalogForTest()
  }
})

test('mirror writes inputModalities for llm-deepseek route', async () => {
  const base = Config({
    multimodalModels: ['deepseek-official/deepseek-chat'],
  })
  const { seam, getDeepseek } = makeMirrorSeam({ base, withDeepseek: true })
  const { ctx } = makeCtx({ seam })
  await apply(ctx, base)
  await tick()
  await tick()

  const ds = getDeepseek()
  assert.deepEqual(ds.models[0].inputModalities, ['text', 'image'], 'deepseek model advertises image input')
})

test('deselecting a multimodal model restores the official defaults', async () => {
  const base = Config({
    multimodalModels: ['deepseek-v4-flash/deepseek-v4-flash'],
  })
  const { seam, getPi } = makeMirrorSeam({ base })
  const { ctx } = makeCtx({ seam })
  await apply(ctx, base)
  await tick()
  await tick()
  assert.deepEqual(getPi().providers['deepseek-v4-flash'].models[0].input, ['text', 'image'], 'mirrored first')

  // Deselect every multimodal model from the card.
  await seam.mutate('llm-proxy', [{ op: 'set', path: ['multimodalModels'], value: [] }])
  await tick()
  await tick()

  const pi = getPi()
  assert.equal(pi.providers['deepseek-v4-flash'].models[0].input, undefined, 'deselect restored official defaults')
  assert.equal(pi.providers.xiaomi.models[0].input, undefined, 'bystander still untouched')
})

test('already-multimodal models keep their declared input untouched', async () => {
  const base = Config({
    multimodalModels: ['deepseek-v4-flash/deepseek-v4-flash-vision-exp'],
  })
  // User already declared image support in settings.yaml  (`input: [text, image]`).
  const seed = structuredClone(PI_AI_VALUE)
  seed.providers['deepseek-v4-flash'].models[1].input = ['text', 'image']
  const { seam, getPi } = makeMirrorSeam({ base, seed })
  const { ctx } = makeCtx({ seam })
  await apply(ctx, base)
  await tick()
  await tick()

  const after = getPi()
  assert.deepEqual(
    after.providers['deepseek-v4-flash'].models[1].input,
    ['text', 'image'],
    'already-multimodal model left as declared',
  )
})
