// The home bento grid's widget registry and the pure layout maths behind
// reorder / resize / show-hide. Deliberately React-free and side-effect
// free (the house style of lib/app-launcher/order.ts and
// lib/workspaces/layout.ts) so every rule here is testable without a DOM.
//
// The registry is the *code* side of the contract; the user's saved order,
// spans and hidden flags live in `user_settings.home_layout`
// (lib/settings/schema.ts). The two are reconciled by `resolveHomeLayout`,
// which never throws and never loses a saved arrangement just because a
// widget was added to or removed from the codebase.

import { clampSpan, mergeHomeLayout, type HomeLayoutEntry, type HomeWidgetSpan } from '@/lib/settings/schema'

export type { HomeLayoutEntry, HomeWidgetSpan }

/**
 * The props every home widget accepts. `span` is how many of the grid's
 * four columns the widget currently occupies, so a widget can show more
 * when it is wide. It is optional: a widget is free to ignore it, and the
 * grid always renders correctly at all four spans.
 *
 * This shape is a fixed cross-phase contract — AppLauncherGlance derives
 * its tile count from exactly this prop.
 */
export interface HomeWidgetProps {
  span?: HomeWidgetSpan
}

/**
 * Stable widget ids. These are persisted to the database, so they are
 * hand-written strings rather than anything derived from render order or
 * a component name — renaming one silently resets that widget's placement.
 */
export type HomeWidgetId =
  | 'daily-goals'
  | 'morning-routine'
  | 'education'
  | 'workspaces'
  | 'money'
  | 'ai-usage'
  | 'research'
  | 'habits'
  | 'people'
  | 'app-launcher'
  | 'calendar'
  | 'health'

export interface HomeWidgetMeta {
  id: HomeWidgetId
  /** Shown in edit mode and in the hidden-widgets tray. */
  label: string
  defaultSpan: HomeWidgetSpan
  /** Registered but off until the user asks for it. */
  defaultHidden: boolean
}

/**
 * Registry order is the default render order, and it matches the grid as
 * it shipped before this was customisable — an untouched home page looks
 * exactly as it did, every card one column wide.
 */
export const HOME_WIDGETS: readonly HomeWidgetMeta[] = [
  { id: 'daily-goals', label: 'Daily goals', defaultSpan: 1, defaultHidden: false },
  { id: 'morning-routine', label: 'Morning routine', defaultSpan: 1, defaultHidden: false },
  { id: 'education', label: 'Education', defaultSpan: 1, defaultHidden: false },
  { id: 'workspaces', label: 'Workspaces', defaultSpan: 1, defaultHidden: false },
  { id: 'money', label: 'Money', defaultSpan: 1, defaultHidden: false },
  { id: 'ai-usage', label: 'AI usage', defaultSpan: 1, defaultHidden: false },
  { id: 'research', label: 'Research', defaultSpan: 1, defaultHidden: false },
  { id: 'habits', label: 'Habits', defaultSpan: 1, defaultHidden: false },
  { id: 'people', label: 'People', defaultSpan: 1, defaultHidden: false },
  { id: 'app-launcher', label: 'App library', defaultSpan: 1, defaultHidden: false },
  { id: 'calendar', label: 'Calendar', defaultSpan: 1, defaultHidden: false },
  // Registered but hidden by default: the Health module is parked and
  // /health calls notFound() (app/health/page.tsx, 2026-09-01). Keeping it
  // in the registry makes restoring the widget the same one-line-revert
  // decision as restoring the page — un-hide this AND remove that
  // notFound(), or the card's link 404s.
  { id: 'health', label: 'Health', defaultSpan: 1, defaultHidden: true },
]

export const HOME_WIDGET_IDS: readonly HomeWidgetId[] = HOME_WIDGETS.map((widget) => widget.id)

const META_BY_ID = new Map<string, HomeWidgetMeta>(HOME_WIDGETS.map((widget) => [widget.id, widget]))

export function homeWidgetMeta(id: string): HomeWidgetMeta | undefined {
  return META_BY_ID.get(id)
}

/** Falls back to the id so an unregistered widget can still be named in the UI. */
export function homeWidgetLabel(id: string): string {
  return META_BY_ID.get(id)?.label ?? id
}

// Tailwind only generates classes it can see written out in full, so every
// span maps to a literal string here rather than a computed `col-span-N`.
// The grid is 1 column on mobile and 2 from `sm`, so wide spans collapse to
// 2 there and only reach their real width at `xl` (the 1440px+ target).
export const SPAN_CLASS: Record<HomeWidgetSpan, string> = {
  1: 'sm:col-span-1 xl:col-span-1',
  2: 'sm:col-span-2 xl:col-span-2',
  3: 'sm:col-span-2 xl:col-span-3',
  4: 'sm:col-span-2 xl:col-span-4',
}

export function spanClass(span: HomeWidgetSpan): string {
  return SPAN_CLASS[span] ?? SPAN_CLASS[1]
}

/** How many columns the home grid has at its widest breakpoint. */
export const HOME_GRID_COLUMNS = 4

/** The layout a user with no saved arrangement sees. */
export function defaultHomeLayout(): HomeLayoutEntry[] {
  return HOME_WIDGETS.map((widget) => ({
    id: widget.id,
    span: widget.defaultSpan,
    hidden: widget.defaultHidden,
  }))
}

/**
 * Reconciles a saved `home_layout` with the registry.
 *
 * `mergeHomeLayout` does the tolerant part (keep saved order, drop unknown
 * ids, clamp spans, append what is missing); this adds the one thing it
 * cannot know about — a newly-registered widget takes its *registry*
 * defaults rather than a bare span-1-and-visible, so `health` stays hidden
 * for a user who already has a saved layout.
 */
export function resolveHomeLayout(stored: readonly HomeLayoutEntry[] | null | undefined): HomeLayoutEntry[] {
  const storedIds = new Set(
    (stored ?? []).map((entry) => entry?.id).filter((id): id is string => typeof id === 'string')
  )

  return mergeHomeLayout(stored, HOME_WIDGET_IDS).map((entry) => {
    if (storedIds.has(entry.id)) return entry
    const meta = META_BY_ID.get(entry.id)
    return meta ? { id: meta.id, span: meta.defaultSpan, hidden: meta.defaultHidden } : entry
  })
}

/** The entries the grid renders, in order. */
export function visibleWidgets(layout: readonly HomeLayoutEntry[]): HomeLayoutEntry[] {
  return layout.filter((entry) => !entry.hidden)
}

/** The entries the hidden-widgets tray offers to restore, in order. */
export function hiddenWidgets(layout: readonly HomeLayoutEntry[]): HomeLayoutEntry[] {
  return layout.filter((entry) => entry.hidden)
}

/**
 * Moves `activeId` to `overId`'s position, keeping every other entry's
 * relative order. Indexes are into the *full* layout, hidden entries
 * included, so dragging one visible card past another never disturbs
 * where a hidden widget would reappear. Unknown ids are a no-op.
 */
export function reorderLayout(
  layout: readonly HomeLayoutEntry[],
  activeId: string,
  overId: string
): HomeLayoutEntry[] {
  const from = layout.findIndex((entry) => entry.id === activeId)
  const to = layout.findIndex((entry) => entry.id === overId)
  if (from === -1 || to === -1 || from === to) return layout.slice()

  const next = layout.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Sets one widget's column span, clamped to 1-4. Unknown ids are a no-op. */
export function setWidgetSpan(layout: readonly HomeLayoutEntry[], id: string, span: number): HomeLayoutEntry[] {
  const clamped = clampSpan(span)
  return layout.map((entry) => (entry.id === id ? { ...entry, span: clamped } : entry))
}

/** Hidden means "not rendered"; the widget's own data is untouched. */
export function setWidgetHidden(layout: readonly HomeLayoutEntry[], id: string, hidden: boolean): HomeLayoutEntry[] {
  return layout.map((entry) => (entry.id === id ? { ...entry, hidden } : entry))
}

export function toggleWidgetHidden(layout: readonly HomeLayoutEntry[], id: string): HomeLayoutEntry[] {
  return layout.map((entry) => (entry.id === id ? { ...entry, hidden: !entry.hidden } : entry))
}

/** True when `layout` is exactly the registry defaults (used to disable "Reset"). */
export function isDefaultLayout(layout: readonly HomeLayoutEntry[]): boolean {
  const defaults = defaultHomeLayout()
  if (layout.length !== defaults.length) return false
  return defaults.every((expected, index) => {
    const actual = layout[index]
    return actual.id === expected.id && actual.span === expected.span && actual.hidden === expected.hidden
  })
}

/**
 * Column span implied by dragging a widget's corner to `pointerX`.
 *
 * `trackWidth`/`gap` come from the grid's computed `grid-template-columns`
 * and `column-gap`, so this is exact rather than an estimate: a span-n
 * widget is `n * trackWidth + (n - 1) * gap` wide, and this inverts that.
 * Degenerate measurements (zero-width tracks mid-layout) fall back to the
 * current span rather than snapping everything to 1.
 */
export function spanFromPointer(
  pointerX: number,
  widgetLeft: number,
  trackWidth: number,
  gap: number,
  fallback: HomeWidgetSpan = 1
): HomeWidgetSpan {
  const step = trackWidth + gap
  if (!Number.isFinite(step) || step <= 0) return fallback
  return clampSpan(Math.round((pointerX - widgetLeft + gap) / step))
}
