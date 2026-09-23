// Pure types + defaults + tolerant normalisation for `user_settings`
// (Phase P1 of the home-customisation plan). Framework-agnostic, no
// Supabase import here — see lib/workspaces/layout.ts and
// lib/app-launcher/order.ts for the house style this follows.
//
// The migration (supabase/migrations/20260920000000_user_settings.sql) is
// applied by hand, so a user may have no row, a partially-shaped row, or
// (briefly, before the migration is run) no table at all. Every function
// here is defensive against malformed/missing input rather than throwing —
// lib/settings/use-settings.ts leans on that to fall back to defaults.

export type HomeWidgetSpan = 1 | 2 | 3 | 4

/** One widget's placement in the home grid, in render order. */
export interface HomeLayoutEntry {
  id: string
  span: HomeWidgetSpan
  hidden: boolean
}

/** The normalised, always-valid shape the rest of the app reads/writes. */
export interface UserSettings {
  home_layout: HomeLayoutEntry[]
  hidden_nav_items: string[]
  launcher_link_ids: string[]
}

/** What a user with no `user_settings` row yet sees. */
export function defaultSettings(): UserSettings {
  return { home_layout: [], hidden_nav_items: [], launcher_link_ids: [] }
}

/** Clamps to a valid span, defaulting to 1 for anything unparseable. */
export function clampSpan(span: unknown): HomeWidgetSpan {
  const n = typeof span === 'number' ? span : Number(span)
  if (!Number.isFinite(n)) return 1
  return Math.min(4, Math.max(1, Math.round(n))) as HomeWidgetSpan
}

function isPlainHomeLayoutEntry(value: unknown): value is { id: string; span?: unknown; hidden?: unknown } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
}

/**
 * Defensively parses a raw (untrusted) `home_layout` value into well-formed
 * entries: non-objects, entries without a string `id`, and duplicate ids
 * are dropped; spans are clamped; `hidden` is coerced to boolean. Does not
 * know about the widget registry — see `mergeHomeLayout` for that.
 */
export function parseHomeLayout(raw: unknown): HomeLayoutEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const entries: HomeLayoutEntry[] = []
  for (const item of raw) {
    if (!isPlainHomeLayoutEntry(item) || seen.has(item.id)) continue
    seen.add(item.id)
    entries.push({ id: item.id, span: clampSpan(item.span), hidden: Boolean(item.hidden) })
  }
  return entries
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}

/**
 * Parses a raw `user_settings` row (or null, e.g. no row / missing table)
 * into a fully-defaulted `UserSettings`. Never throws.
 */
export function parseUserSettings(
  row:
    | { home_layout?: unknown; hidden_nav_items?: unknown; launcher_link_ids?: unknown }
    | null
    | undefined
): UserSettings {
  if (!row) return defaultSettings()
  return {
    home_layout: parseHomeLayout(row.home_layout),
    hidden_nav_items: parseStringArray(row.hidden_nav_items),
    launcher_link_ids: parseStringArray(row.launcher_link_ids),
  }
}

/**
 * Tolerant merge of a stored `home_layout` against the app's current home
 * widget registry (`knownIds`, in canonical/default order):
 * - entries whose id is no longer a known widget are dropped (the widget
 *   was removed from code)
 * - known widgets missing from `stored` are appended, in registry order,
 *   with default placement (span 1, not hidden)
 * - spans are clamped to 1-4
 *
 * Stored order and hidden flags are otherwise preserved untouched, so a
 * widget being added or removed from the codebase never breaks a saved
 * layout.
 */
export function mergeHomeLayout(
  stored: readonly HomeLayoutEntry[] | null | undefined,
  knownIds: readonly string[]
): HomeLayoutEntry[] {
  const known = new Set(knownIds)
  const seen = new Set<string>()
  const merged: HomeLayoutEntry[] = []

  for (const entry of stored ?? []) {
    if (!entry || !known.has(entry.id) || seen.has(entry.id)) continue
    seen.add(entry.id)
    merged.push({ id: entry.id, span: clampSpan(entry.span), hidden: Boolean(entry.hidden) })
  }
  for (const id of knownIds) {
    if (!seen.has(id)) merged.push({ id, span: 1, hidden: false })
  }
  return merged
}
