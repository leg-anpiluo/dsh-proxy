/**
 * 模型代理 plugin card: one card inside 设置 → 插件 → 可配置插件
 * (the `settings.plugin.item` slot, declared at runtime by
 * @deepseek-ai/dsh-client-ui-settings-plugins). The header names the plugin
 * and discloses the configurable items in place — the proxy endpoint
 * (host + port), the 走代理的模型 multi-select (populated from the configured
 * model list via the host bridge), and the retry policy (retries + interval).
 * Written through the llm-proxy settings scope (official path with the rc.6
 * bridge fallback). Changes apply live on the host — no restart needed.
 *
 * Everything else stays on the DIRECT path by default; only the selected
 * models' baseURL hosts route through the proxy. Loopback is always direct.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
// Namespace import on purpose: the chevron's export name differs between host
// generations, so the icon is looked up as a property (chevron.tsx) instead of
// being bound by name — a named import of the wrong generation is `undefined`
// at runtime and renders as "Element type is invalid".
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-settings-plugins SlotMap merge (the
// 'settings.plugin.item' entry the configurable tab declares at runtime).
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { pickChevronIcon } from './chevron.tsx'
import type {
  FieldWrite, ProxyModelRow, ProxyModelScope, ProxyModelSnapshot, TestResult,
} from './settings-scope.ts'
import type { en } from './locales.ts'
import styles from './proxy-model.module.css'

/** Injected dependencies of the card (slot `inject`). */
export interface ProxyModelCardInjected {
  /** The bound llm-proxy settings scope (official → bridge fallback). */
  scope: ProxyModelScope
  /** uSES subscription hook bound to the scope snapshot. */
  useSnapshot: () => ProxyModelSnapshot
  /** Card copy. */
  t: (key: keyof typeof en) => string
}

/**
 * Props delivered by the slot outlet (inject face spread flat).
 *
 * Two hosts deliver this card: dsh ≤ 0.1.6 sends the keyed
 * `settings.plugin.item` props (no subject — the card *is* the row), while
 * dsh ≥ 0.1.7 sends `plugins.item` props, which carry the render subject. The
 * host renders that slot three times: `{ view: 'summary' }` for the list row's
 * description and for the detail header, and `{ view: 'page', form }` for the
 * detail body. `form` is the host's own `{ state, mutate }` projection of the
 * config controller — not the live controller — so the card keeps binding the
 * `configForms` document itself (reactive subscribe + set/unset/recover), which
 * that projection cannot offer.
 */
export type ProxyModelCardProps =
  PropsRuntime<'settings.plugin.item'>
  & InjectFace<ProxyModelCardInjected>
  & {
    /** Which rendering of the root list slot this is (dsh ≥ 0.1.7). */
    view?: 'summary' | 'page'
    /** Host-supplied `{ state, mutate }` projection for the page view. */
    form?: unknown
  }

/**
 * The card's disclosure glyph, resolved once against the host's primitives
 * build (the export name differs between host generations — see chevron.tsx).
 */
const ChevronDown = pickChevronIcon(primitives)

/** The resolved llm-proxy config shape (mirrors lib/index.js Config). */
interface ProxyConfig {
  proxyHost: string
  proxyPort: number
  proxiedModels: string[]
  multimodalModels: string[]
  retries: number
  retryIntervalMs: number
  failoverEnabled: boolean
  failoverProxy: string
  negativeCacheTtlMs: number
}

/** Schema defaults mirrored from lib/index.js (reset target + base merge). */
const DEFAULTS: ProxyConfig = {
  proxyHost: '127.0.0.1',
  proxyPort: 7897,
  proxiedModels: [],
  multimodalModels: [],
  retries: 3,
  retryIntervalMs: 1000,
  failoverEnabled: true,
  failoverProxy: '',
  negativeCacheTtlMs: 60000,
}

/** Fields surfaced in the UI, in write order. */
const UI_FIELDS = [
  'proxyHost',
  'proxyPort',
  'proxiedModels',
  'multimodalModels',
  'retries',
  'retryIntervalMs',
  'failoverEnabled',
  'failoverProxy',
  'negativeCacheTtlMs',
] as const

/** The draft form state backing the manual-entry fields. */
interface FormState {
  proxyHost: string
  proxyPort: string
  proxiedModels: string[]
  multimodalModels: string[]
  retries: string
  retryIntervalMs: string
  failoverEnabled: boolean
  failoverProxy: string
  negativeCacheTtlMs: string
}

/** JSON-compatible deep equality (the card values are plain JSON). */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Build a fresh empty form. */
function emptyForm(): FormState {
  return {
    proxyHost: '',
    proxyPort: String(DEFAULTS.proxyPort),
    proxiedModels: [],
    multimodalModels: [],
    retries: String(DEFAULTS.retries),
    retryIntervalMs: String(DEFAULTS.retryIntervalMs),
    failoverEnabled: DEFAULTS.failoverEnabled,
    failoverProxy: DEFAULTS.failoverProxy,
    negativeCacheTtlMs: String(DEFAULTS.negativeCacheTtlMs),
  }
}

/** Hydrate the form from a resolved config value. */
function formFromConfig(value: ProxyConfig): FormState {
  return {
    proxyHost: value.proxyHost ?? '',
    proxyPort: String(value.proxyPort ?? DEFAULTS.proxyPort),
    proxiedModels: [...(value.proxiedModels ?? [])],
    multimodalModels: [...(value.multimodalModels ?? [])],
    retries: String(value.retries ?? DEFAULTS.retries),
    retryIntervalMs: String(value.retryIntervalMs ?? DEFAULTS.retryIntervalMs),
    failoverEnabled: value.failoverEnabled ?? DEFAULTS.failoverEnabled,
    failoverProxy: value.failoverProxy ?? DEFAULTS.failoverProxy,
    negativeCacheTtlMs: String(value.negativeCacheTtlMs ?? DEFAULTS.negativeCacheTtlMs),
  }
}

/** Extract one top-level field's plain-JSON value from the form. */
function fieldFromForm(form: FormState, field: (typeof UI_FIELDS)[number]): unknown {
  switch (field) {
    case 'proxyHost': return form.proxyHost.trim()
    case 'proxyPort': return Number(form.proxyPort)
    case 'proxiedModels': return [...form.proxiedModels]
    case 'multimodalModels': return [...form.multimodalModels]
    case 'retries': return Number(form.retries)
    case 'retryIntervalMs': return Number(form.retryIntervalMs)
    case 'failoverEnabled': return form.failoverEnabled === true
    case 'failoverProxy': return form.failoverProxy.trim()
    case 'negativeCacheTtlMs': return Number(form.negativeCacheTtlMs)
  }
}

/** Validate the draft; returns an error key or null. */
function validateForm(form: FormState): 'invalidEmpty' | 'invalidRange' | 'invalidProxyUrl' | null {
  if (form.proxyHost.trim() === '') return 'invalidEmpty'
  if (!/^\d+$/.test(form.proxyPort.trim())) return 'invalidRange'
  const port = Number(form.proxyPort)
  if (port < 1 || port > 65535) return 'invalidRange'
  if (!/^\d+$/.test(form.retries.trim())) return 'invalidRange'
  if (!/^\d+$/.test(form.retryIntervalMs.trim())) return 'invalidRange'
  if (Number(form.retries) > 10) return 'invalidRange'
  if (Number(form.retryIntervalMs) > 60000) return 'invalidRange'
  if (!/^\d+$/.test(form.negativeCacheTtlMs.trim())) return 'invalidRange'
  if (Number(form.negativeCacheTtlMs) > 3600000) return 'invalidRange'
  const failoverProxy = form.failoverProxy.trim()
  if (failoverProxy !== '' && !/^https?:\/\//.test(failoverProxy) && !/^socks5?:\/\//.test(failoverProxy)) {
    return 'invalidProxyUrl'
  }
  return null
}

/** Compute the field writes that land the form on the resolved value. */
function diffWrites(form: FormState, snapshot: ProxyModelSnapshot): FieldWrite[] {
  const value = snapshot.value as ProxyConfig | undefined
  const base = snapshot.base as Partial<ProxyConfig> | undefined
  const writes: FieldWrite[] = []
  for (const field of UI_FIELDS) {
    const next = fieldFromForm(form, field)
    const current = value?.[field]
    if (deepEqual(next, current)) continue
    const baseValue = base?.[field]
    if (deepEqual(next, baseValue)) writes.push({ field, op: 'unset' })
    else writes.push({ field, op: 'set', value: next })
  }
  return writes
}

/** Merge the composition base over the schema defaults (reset target). */
function mergeDefaults(base: Partial<ProxyConfig> | undefined): ProxyConfig {
  return {
    proxyHost: base?.proxyHost ?? DEFAULTS.proxyHost,
    proxyPort: base?.proxyPort ?? DEFAULTS.proxyPort,
    proxiedModels: base?.proxiedModels ?? DEFAULTS.proxiedModels,
    multimodalModels: base?.multimodalModels ?? DEFAULTS.multimodalModels,
    retries: base?.retries ?? DEFAULTS.retries,
    retryIntervalMs: base?.retryIntervalMs ?? DEFAULTS.retryIntervalMs,
    failoverEnabled: base?.failoverEnabled ?? DEFAULTS.failoverEnabled,
    failoverProxy: base?.failoverProxy ?? DEFAULTS.failoverProxy,
    negativeCacheTtlMs: base?.negativeCacheTtlMs ?? DEFAULTS.negativeCacheTtlMs,
  }
}

/** One labeled field; numeric fields use type="number" so non-digits are rejected by the browser. */
function TextField(props: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  testId?: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number
}): ReactNode {
  const { label, hint, value, onChange, placeholder, testId, type = 'text', min, max, step } = props
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint !== undefined && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  )
}

/** The card body: the configurable items form plus the save/reset footer. */
function CardBody(props: Required<ProxyModelCardInjected>): ReactNode {
  const { scope, useSnapshot, t } = props
  const snapshot = useSnapshot()
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hydratedRef = useRef(false)
  const [models, setModels] = useState<ProxyModelRow[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [testingKey, setTestingKey] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  // Hydrate the form once from the first ready snapshot.
  useEffect(() => {
    if (snapshot.status === 'ready' && !hydratedRef.current) {
      hydratedRef.current = true
      setForm(formFromConfig(snapshot.value as ProxyConfig))
    }
  }, [snapshot.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the selectable model list from the host bridge (once the body shows).
  useEffect(() => {
    if (models.length > 0 || modelsError !== null) return
    let cancelled = false
    scope.listModels()
      .then((rows) => {
        if (!cancelled) setModels(rows)
      })
      .catch(() => {
        if (!cancelled) setModelsError(t('statusUnavailable'))
      })
    return () => { cancelled = true }
  }, [models.length, modelsError, scope, t])

  if (snapshot.status === 'loading') {
    return <p className={styles.status}>{t('statusLoading')}</p>
  }
  if (snapshot.status === 'unavailable') {
    return <p className={styles.status}>{t('statusUnavailable')}</p>
  }

  const handleSave = async (): Promise<void> => {
    const validation = validateForm(form)
    if (validation !== null) {
      setSaved(false)
      setError(t(validation))
      return
    }
    const writes = diffWrites(form, snapshot)
    if (writes.length === 0) {
      setSaved(true)
      setError(null)
      return
    }
    setSaving(true)
    setError(null)
    const result = await scope.mutate(writes)
    setSaving(false)
    if (result.ok) {
      setSaved(true)
    } else {
      setSaved(false)
      setError(result.message ?? t('saveError'))
    }
  }

  const handleReset = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    const result = await scope.mutate(UI_FIELDS.map((field) => ({ field, op: 'unset' })))
    setSaving(false)
    if (result.ok) {
      setForm(formFromConfig(mergeDefaults(snapshot.base as Partial<ProxyConfig> | undefined)))
      setSaved(true)
    } else {
      setSaved(false)
      setError(result.message ?? t('saveError'))
    }
  }

  const toggleModel = (key: string): void => {
    setSaved(false)
    const selected = form.proxiedModels.includes(key)
      ? form.proxiedModels.filter((k) => k !== key)
      : [...form.proxiedModels, key]
    setForm({ ...form, proxiedModels: selected })
  }

  const toggleMultimodal = (key: string): void => {
    setSaved(false)
    const selected = form.multimodalModels.includes(key)
      ? form.multimodalModels.filter((k) => k !== key)
      : [...form.multimodalModels, key]
    setForm({ ...form, multimodalModels: selected })
  }

  const handleTest = async (key: string): Promise<void> => {
    setTestingKey(key)
    const result = await scope.test(key)
    setTestResults((previous) => ({ ...previous, [key]: result }))
    setTestingKey(null)
  }

  /** One-line test detail: ✓ 连接成功 · 200 · 38ms · 经代理 · 多模态已开启 / ✗ 连接失败：… */
  const formatTestDetail = (result: TestResult): string => {
    if (result.ok) {
      const parts: string[] = []
      if (typeof result.status === 'number') parts.push(String(result.status))
      if (typeof result.latencyMs === 'number') parts.push(`${result.latencyMs}ms`)
      parts.push(result.viaProxy ? t('testViaProxy') : t('testDirect'))
      if (result.multimodal) parts.push(t('testMultimodalOn'))
      return parts.length > 0 ? ` · ${parts.join(' · ')}` : ''
    }
    return `：${result.message ?? result.code ?? t('testFail')}`
  }

  /** Display label for a model row: `[厂商] 模型名`; the vendor prefix is
   * dropped when the model name already carries it (e.g. B.AI names are
   * already "deepseek-v4-flash（B.AI）", so the bracketed prefix would just
   * repeat the same text). */
  const rowLabel = (row: ProxyModelRow): string =>
    row.providerLabel !== '' && !row.name.includes(row.providerLabel)
      ? `[${row.providerLabel}] ${row.name}`
      : row.name

  /**
   * Models still selectable (not yet proxied), in config order. Every listed
   * model is offered regardless of whether its provider already resolves a
   * baseURL host: a provider without one simply routes nothing until the user
   * fills its baseURL in the Models page (the host resolver skips empty hosts
   * instead of erroring), so hiding those rows only made the list look
   * partial.
   */
  const selectableModels = (): ProxyModelRow[] =>
    models.filter((row) => !form.proxiedModels.includes(row.key))

  return (
    <div className={styles.body} data-testid="proxy-model-form">
      <div className={styles.fieldRow}>
        <TextField
          label={t('fieldProxyHost')}
          hint={t('fieldProxyHostHint')}
          value={form.proxyHost}
          placeholder={DEFAULTS.proxyHost}
          testId="field-proxyHost"
          onChange={(value) => { setSaved(false); setForm({ ...form, proxyHost: value }) }}
        />
        <TextField
          label={t('fieldProxyPort')}
          hint={t('fieldProxyPortHint')}
          value={form.proxyPort}
          placeholder={String(DEFAULTS.proxyPort)}
          testId="field-proxyPort"
          type="number"
          min={1}
          max={65535}
          step={1}
          onChange={(value) => { setSaved(false); setForm({ ...form, proxyPort: value }) }}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('fieldProxiedModels')}</span>
        <span className={styles.fieldHint}>{t('fieldProxiedModelsHint')}</span>
        {modelsError !== null
          ? <p className={styles.status}>{modelsError}</p>
          : models.length === 0
            ? <p className={styles.status}>{t('statusLoading')}</p>
            : (
              <ul className={styles.rowList}>
                {form.proxiedModels.map((key) => {
                  const row = models.find((m) => m.key === key)
                  const result = testResults[key]
                  return (
                    <li key={key} className={styles.rowWrap}>
                      <div className={styles.row}>
                        <span className={styles.rowLabel}>{row ? rowLabel(row) : key}</span>
                        <button
                          type="button"
                          className={styles.rowTest}
                          data-testid="test-proxied-model"
                          disabled={testingKey !== null}
                          onClick={() => { void handleTest(key) }}
                        >
                          {testingKey === key ? t('testing') : t('test')}
                        </button>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          data-testid="remove-proxied-model"
                          onClick={() => toggleModel(key)}
                        >
                          {t('remove')}
                        </button>
                      </div>
                      {result !== undefined && (
                        <span
                          className={`${styles.testResult} ${result.ok ? styles.testResultOk : styles.testResultError}`}
                          data-testid="test-proxied-result"
                        >
                          {result.ok ? '✓ ' : '✗ '}{result.ok ? t('testOk') : t('testFail')}{formatTestDetail(result)}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
        <select
          className={styles.select}
          data-testid="add-proxied-model"
          value=""
          disabled={models.length === 0}
          onChange={(event) => {
            if (event.target.value !== '') toggleModel(event.target.value)
          }}
        >
          <option value="">{t('selectModel')}</option>
          {selectableModels().map((row) => (
            <option key={row.key} value={row.key}>{rowLabel(row)}</option>
          ))}
        </select>
        {form.proxiedModels.length > 0 && (
          <span className={styles.testBarHint}>{t('testBarHint')}</span>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('fieldMultimodalModels')}</span>
        <span className={styles.fieldHint}>{t('fieldMultimodalModelsHint')}</span>
        {modelsError !== null
          ? <p className={styles.status}>{modelsError}</p>
          : models.length === 0
            ? <p className={styles.status}>{t('statusLoading')}</p>
            : (
              <ul className={styles.rowList}>
                {form.multimodalModels.map((key) => {
                  const row = models.find((m) => m.key === key)
                  return (
                    <li key={key} className={styles.row}>
                      <span className={styles.rowLabel}>{row ? rowLabel(row) : key}</span>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        data-testid="remove-multimodal-model"
                        onClick={() => toggleMultimodal(key)}
                      >
                        {t('remove')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
        <select
          className={styles.select}
          data-testid="add-multimodal-model"
          value=""
          disabled={models.length === 0}
          onChange={(event) => {
            if (event.target.value !== '') toggleMultimodal(event.target.value)
          }}
        >
          <option value="">{t('selectModel')}</option>
          {models
            .filter((row) => !form.multimodalModels.includes(row.key))
            .map((row) => (
              <option key={row.key} value={row.key}>
                {rowLabel(row)}{row.inputModalities.includes('image') ? `（${t('multimodalBadge')}）` : ''}
              </option>
            ))}
        </select>
      </div>

      <div className={styles.fieldRow}>
        <TextField
          label={t('fieldRetries')}
          hint={t('fieldRetriesHint')}
          value={form.retries}
          placeholder={String(DEFAULTS.retries)}
          testId="field-retries"
          type="number"
          min={0}
          max={10}
          step={1}
          onChange={(value) => { setSaved(false); setForm({ ...form, retries: value }) }}
        />
        <TextField
          label={t('fieldRetryIntervalMs')}
          hint={t('fieldRetryIntervalMsHint')}
          value={form.retryIntervalMs}
          placeholder={String(DEFAULTS.retryIntervalMs)}
          testId="field-retryIntervalMs"
          type="number"
          min={0}
          max={60000}
          step={1}
          onChange={(value) => { setSaved(false); setForm({ ...form, retryIntervalMs: value }) }}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('fieldFailoverEnabled')}</span>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            data-testid="field-failoverEnabled"
            checked={form.failoverEnabled}
            onChange={(event) => { setSaved(false); setForm({ ...form, failoverEnabled: event.target.checked }) }}
          />
          <span className={styles.checkLabel}>{form.failoverEnabled ? t('failoverOn') : t('failoverOff')}</span>
        </label>
        <span className={styles.fieldHint}>{t('fieldFailoverEnabledHint')}</span>
        <div className={form.failoverEnabled ? styles.fieldRow : styles.fieldRowDisabled}>
          <TextField
            label={t('fieldFailoverProxy')}
            hint={t('fieldFailoverProxyHint')}
            value={form.failoverProxy}
            placeholder={`${DEFAULTS.proxyHost}:${DEFAULTS.proxyPort}`}
            testId="field-failoverProxy"
            onChange={(value) => { setSaved(false); setForm({ ...form, failoverProxy: value }) }}
          />
          <TextField
            label={t('fieldNegativeCacheTtlMs')}
            hint={t('fieldNegativeCacheTtlMsHint')}
            value={form.negativeCacheTtlMs}
            placeholder={String(DEFAULTS.negativeCacheTtlMs)}
            testId="field-negativeCacheTtlMs"
            type="number"
            min={0}
            max={3600000}
            step={1000}
            onChange={(value) => { setSaved(false); setForm({ ...form, negativeCacheTtlMs: value }) }}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.primaryButton}
          data-testid="save-proxy-model"
          disabled={saving || !snapshot.writable}
          onClick={() => { void handleSave() }}
        >
          {saving ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          className={styles.ghostButton}
          data-testid="reset-proxy-model"
          disabled={saving || !snapshot.writable}
          onClick={() => { void handleReset() }}
        >
          {t('reset')}
        </button>
        {saved && !error && <span className={`${styles.saveStatus} ${styles.saveStatusOk}`}>{t('saved')}</span>}
        {error !== null && <span className={`${styles.saveStatus} ${styles.saveStatusError}`}>{t('saveError')}：{error}</span>}
      </div>
    </div>
  )
}

/**
 * The inline description dsh ≥ 0.1.7 renders for this slot
 * (`{ view: 'summary' }`): the Plugins list row's description and the detail
 * page header. It must stay inline content — the host wraps it in its own row
 * and card, and the host's own open action lives there, so the interactive
 * `<li>` above would both nest a list item inside the host's and swallow that
 * action. Falls back to the static one-liner while the document is loading.
 */
function ProxyModelSummary({ useSnapshot, t }: {
  useSnapshot: () => ProxyModelSnapshot
  t: (key: keyof typeof en) => string
}): ReactNode {
  const snapshot = useSnapshot()
  const config = snapshot.status === 'ready' ? (snapshot.value as ProxyConfig | undefined) : undefined
  const models = config?.proxiedModels ?? []
  return (
    <span className={styles.description} data-testid="proxy-model-summary">
      {config === undefined
        ? t('description')
        : `${config.proxyHost}:${config.proxyPort} · ${models.length} ${t('summaryModels')}`}
    </span>
  )
}

/**
 * The 模型代理 plugin card: a header naming the plugin over a line describing
 * what its settings govern, disclosing the configurable items in place.
 * Renders nothing (returns null) until the slot outlet supplies the inject
 * face; the section itself stacks cards and reports their count.
 */
export function ProxyModelCard(props: ProxyModelCardProps): ReactNode {
  const { scope, useSnapshot, t } = props
  const [open, setOpen] = useState(false)
  if (scope === undefined || useSnapshot === undefined || t === undefined) return null
  // The summary renderings are not the card (see ProxyModelSummary); only the
  // page view and the ≤ 0.1.6 keyed slot (no `view` at all) get the <li>.
  if (props.view === 'summary') return <ProxyModelSummary useSnapshot={useSnapshot} t={t} />
  return (
    <li className={styles.card}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        data-testid="proxy-model-card-header"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.headText}>
          <span className={styles.name}>{t('title')}</span>
          <span className={styles.description}>{t('description')}</span>
        </span>
        <ChevronDown className={styles.chevron + (open ? ` ${styles.chevronOpen}` : '')} />
      </button>
      {open && <CardBody scope={scope} useSnapshot={useSnapshot} t={t} />}
    </li>
  )
}
