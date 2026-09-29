/**
 * Module-table contract tests for the card, driven through the **real built
 * bundle** with a stubbed module loader.
 *
 * Two host-generation contracts live here, both invisible to the fake-based
 * unit tests because they only break against a real host:
 *
 *  1. The disclosure glyph's export name changed (`IconChevronDownOutline14`
 *     ≤ 0.1.6 → `…OutlineRegular`/`…Medium`/`…Outline` ≥ 0.1.7) while the
 *     build-time devDependency stays pinned to the old generation. Binding it
 *     by name makes it `undefined` at runtime — React's "Element type is
 *     invalid", which takes the whole settings page down.
 *  2. `plugins.item` is rendered three times per page with a subject:
 *     `{ view: 'summary' }` twice (as inline description) and
 *     `{ view: 'page', form }` once. A summary that renders the interactive
 *     `<li>` card nests a list item in the host's row and swallows its own
 *     open action.
 *
 * Run: node --test test/client-chevron.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

const SOURCE = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

/** A host Service class the bundle extends at load time. */
class FakeService {
  constructor(ctx) {
    this.ctx = ctx
  }
}

const reactStub = {
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
}
/** plain-object JSX runtime: an element is `{ type, props }`, no React needed. */
const jsxStub = {
  Fragment: Symbol.for('react.fragment'),
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
}

/**
 * Load the bundle the way the host's module loader does.
 * @param primitivesExports - the module object for the host's primitives build.
 * @returns the bundle's exports.
 */
function loadBundle(primitivesExports) {
  let captured
  const sandbox = {
    console,
    window: { __ModuleLoader__: { load: (definition) => { captured = definition } } },
  }
  runInContext(SOURCE, createContext(sandbox))
  assert.ok(captured, 'the bundle registered itself with the module loader')
  assert.equal(captured.id, '@anpiluo/dsh-proxy')
  const require = (id) => {
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitivesExports
    if (id === 'react') return reactStub
    if (id === 'react/jsx-runtime') return jsxStub
    if (id === '@deepseek-ai/cordis') return { Service: FakeService }
    if (id === '@deepseek-ai/dsh-client-store') {
      return { createSnapshotStore: () => ({ getSnapshot: () => ({}), subscribe: () => () => {} }) }
    }
    return {}
  }
  return captured.factory(require)
}

/**
 * Run `apply` against a fake client context and hand back the components the
 * plugin registered on each slot.
 * @param primitivesExports - the host's primitives module object.
 * @returns the component registered on `plugins.item` (dsh ≥ 0.1.7).
 */
function renderSetup(primitivesExports) {
  const mod = loadBundle(primitivesExports)
  const registered = []
  const ctx = {
    effect: (fn) => { fn(); return () => {} },
    get: () => undefined,
    on: () => () => {},
    locale: { register: () => {}, bind: () => (key) => key },
    slots: {
      inject: (name, generator) => { for (const handle of generator()) void handle },
      register: (options, component) => {
        registered.push({ slot: options.name, component })
        return () => {}
      },
    },
  }
  mod.apply(ctx)
  const entry = registered.find((item) => item.slot === 'plugins.item')
  assert.ok(entry, 'plugins.item was registered (dsh ≥ 0.1.7 surface)')
  return {
    mod,
    registered,
    card: entry.component,
    props: {
      view: 'page',
      scope: { subscribe: () => () => {}, getSnapshot: () => ({ status: 'loading', writable: false }) },
      useSnapshot: () => ({ status: 'loading', writable: false }),
      t: (key) => key,
    },
  }
}

/** Collect every element type in a plain-object JSX tree (no components run). */
function elementTypes(node, found = []) {
  if (Array.isArray(node)) {
    for (const child of node) elementTypes(child, found)
  } else if (node !== null && typeof node === 'object' && 'type' in node) {
    found.push(node.type)
    elementTypes(node.props?.children, found)
  }
  return found
}

/**
 * Execute function components the way React would, so the tree bottoms out in
 * host elements (the plain-object jsx stub only records `{ type, props }`).
 */
function resolveTree(node) {
  if (Array.isArray(node)) return node.map(resolveTree)
  if (node !== null && typeof node === 'object' && 'type' in node) {
    if (typeof node.type === 'function') return resolveTree(node.type(node.props))
    return { ...node, props: { ...node.props, children: resolveTree(node.props?.children) } }
  }
  return node
}

const oldGeneration = () => ({ IconChevronDownOutline14: function Old() {} })
const newGeneration = () => ({
  IconChevronDownOutlineRegular: function Regular() {},
  IconChevronDownOutlineMedium: function Medium() {},
  IconChevronDownOutline: function Base() {},
})

test('≤0.1.6 renders its native chevron', () => {
  const primitives = oldGeneration()
  const { card, props } = renderSetup(primitives)
  assert.ok(elementTypes(card(props)).includes(primitives.IconChevronDownOutline14))
})

test('≥0.1.7 renders the renamed chevron instead of undefined', () => {
  const primitives = newGeneration()
  const { card, props } = renderSetup(primitives)
  const types = elementTypes(card(props))
  assert.ok(types.includes(primitives.IconChevronDownOutlineRegular), 'the host glyph is rendered')
  assert.ok(!types.includes(undefined), 'no JSX type is undefined (React error #130)')
})

test('an unknown future rename renders the inline fallback', () => {
  const { card, props } = renderSetup({ IconChevronDownOutlineNext: function Next() {} })
  const types = elementTypes(resolveTree(card(props)))
  assert.ok(types.includes('svg'), 'the inline chevron is a real element')
  assert.ok(!types.includes(undefined), 'no JSX type is undefined')
})

test('the summary rendering stays inline and interactive-free', () => {
  const primitives = newGeneration()
  const { card, props } = renderSetup(primitives)
  const summary = resolveTree(card({ ...props, view: 'summary' }))
  assert.equal(summary.type, 'span', 'inline content, not a nested <li>')
  assert.equal(summary.props['data-testid'], 'proxy-model-summary')
  assert.ok(!elementTypes(summary).includes('li'), 'never nests a list item in the host row')
  assert.ok(!elementTypes(summary).includes('button'), 'the host owns the open action')
})

test('the page rendering is still the interactive card', () => {
  const { card, props } = renderSetup(newGeneration())
  const page = card(props)
  assert.equal(page.type, 'li')
  assert.ok(elementTypes(page).includes('button'))
})

test('the bundle never binds a host icon by name', () => {
  // A named import of the wrong generation is exactly the crash: the binding is
  // undefined at runtime and React refuses the JSX type.
  assert.doesNotMatch(SOURCE, /jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.IconChevronDownOutline14/)
})
