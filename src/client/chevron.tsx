/**
 * Host-agnostic lookup for the card's chevron glyph.
 *
 * The host owns this icon: the client bundle only *names* it, and the runtime
 * module table supplies whatever `@deepseek-ai/dsh-client-ui-primitives` the
 * installed dsh ships. That name changed — ≤ 0.1.6 exports
 * `IconChevronDownOutline14`, ≥ 0.1.7 dropped it in favour of
 * `IconChevronDownOutline` / `…Regular` / `…Medium` — while the build-time
 * devDependency stays pinned to the older generation. Nothing in the build can
 * see the drift: a named import of *either* generation type-checks, and the
 * other one is simply `undefined` at runtime, which React reports as
 * "Element type is invalid" and takes the whole settings page down.
 *
 * Resolution therefore goes through a **property lookup on the host module
 * object** (never a named import, so a missing name is a value, not a link
 * error) and ends in a local inline SVG, so some component is always returned.
 */
import type { ReactNode } from 'react'

/** What this plugin needs from a host icon: a component taking a class name. */
export type ChevronComponent = (props: { className?: string }) => ReactNode

/**
 * Oldest → newest spelling of the same 14px chevron. Ordered so the current
 * generation is preferred and older hosts keep their native glyph.
 */
const CHEVRON_EXPORTS = [
  'IconChevronDownOutline14',
  'IconChevronDownOutlineRegular',
  'IconChevronDownOutlineMedium',
  'IconChevronDownOutline',
] as const

/**
 * Dependency-free chevron. Deliberately a local element rather than a host
 * import: it is what makes a future rename a cosmetic regression instead of a
 * blank page.
 * @param props - only the class name the card styles it with.
 */
function InlineChevron({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
      data-testid="proxy-model-chevron"
    >
      <path
        d="M3.5 5.25 7 8.75l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Resolve the chevron the host's primitives build actually exports.
 * @param primitives - the host module object (`import * as primitives from …`).
 * @returns the first exported icon found, else the inline fallback.
 */
export function pickChevronIcon(primitives: unknown): ChevronComponent {
  const bag = (primitives ?? {}) as Record<string, unknown>
  for (const name of CHEVRON_EXPORTS) {
    const candidate = bag[name]
    // A component is a function (or a callable/forwardRef object); anything
    // else — undefined on a host that renamed the export — is skipped.
    if (typeof candidate === 'function') return candidate as ChevronComponent
    if (typeof candidate === 'object' && candidate !== null) return candidate as ChevronComponent
  }
  return InlineChevron
}
