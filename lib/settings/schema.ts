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

import { isDateKey, mondayOf } from '@/lib/blackboard/dates'
import { WORK_CATEGORIES, WORK_TABS, isWorkCategory, type WorkCategory, type WorkTab } from '@/lib/blackboard/work'

export type HomeWidgetSpan = 1 | 2 | 3 | 4

/** One widget's placement in the home grid, in render order. */
export interface HomeLayoutEntry {
  id: string
  span: HomeWidgetSpan
  hidden: boolean
  /** Minimum card height in px. Absent = size to content (the default). */
  height?: number
}

export const MIN_WIDGET_HEIGHT = 120
export const MAX_WIDGET_HEIGHT = 1600

/** Clamps a stored height; anything unparseable means "auto" (undefined). */
export function clampHeight(height: unknown): number | undefined {
  if (height == null) return undefined
  const n = typeof height === 'number' ? height : Number(height)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(MAX_WIDGET_HEIGHT, Math.max(MIN_WIDGET_HEIGHT, Math.round(n)))
}

function withHeight(entry: HomeLayoutEntry, height: unknown): HomeLayoutEntry {
  const clamped = clampHeight(height)
  return clamped === undefined ? entry : { ...entry, height: clamped }
}

/** The normalised, always-valid shape the rest of the app reads/writes. */
export interface UserSettings {
  home_layout: HomeLayoutEntry[]
  hidden_nav_items: string[]
  launcher_link_ids: string[]
  calendar_view: CalendarView
  work_filter: WorkFilterSetting
  /** Monday of university week 1 ('YYYY-MM-DD'). Null = derive it from the timetable. */
  week_one_start: string | null
}

export type CalendarView = 'month' | 'week' | 'day' | 'routines'
export const CALENDAR_VIEWS: CalendarView[] = ['month', 'week', 'day', 'routines']

/** Falls back to 'week' for anything unrecognised. */
export function parseCalendarView(value: unknown): CalendarView {
  return CALENDAR_VIEWS.includes(value as CalendarView) ? (value as CalendarView) : 'week'
}

/** The /lectures work list's last tab and filter. */
export interface WorkFilterSetting {
  tab: WorkTab
  categories: WorkCategory[] | 'all'
  /** Module codes. */
  modules: string[] | 'all'
}

/** First visit: Upcoming, every category but lecture prep, every module. */
export function defaultWorkFilter(): WorkFilterSetting {
  return { tab: 'upcoming', categories: WORK_CATEGORIES.filter((c) => c !== 'lecture_prep'), modules: 'all' }
}

/**
 * Tolerant: an unknown tab falls back to Upcoming, unknown categories are
 * dropped (all unknown → the default set), anything malformed → default.
 */
export function parseWorkFilter(raw: unknown): WorkFilterSetting {
  const fallback = defaultWorkFilter()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fallback
  const value = raw as { tab?: unknown; categories?: unknown; modules?: unknown }

  const tab = (WORK_TABS as readonly unknown[]).includes(value.tab) ? (value.tab as WorkTab) : fallback.tab

  let categories: WorkFilterSetting['categories'] = fallback.categories
  if (value.categories === 'all') categories = 'all'
  else if (Array.isArray(value.categories)) {
    const known = [...new Set(value.categories.filter(isWorkCategory))]
    categories = known.length > 0 || value.categories.length === 0 ? known : fallback.categories
  }

  let modules: WorkFilterSetting['modules'] = fallback.modules
  if (value.modules === 'all') modules = 'all'
  else if (Array.isArray(value.modules)) {
    modules = [...new Set(value.modules.filter((m): m is string => typeof m === 'string' && m.trim() !== '').map((m) => m.trim()))]
  }

  return { tab, categories, modules }
}

/** A valid date snapped to its Monday (weeks start on Mondays); anything else → null. */
export function parseWeekOneStart(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const key = raw.slice(0, 10)
  return isDateKey(key) ? mondayOf(key) : null
}

/** What a user with no `user_settings` row yet sees. */
export function defaultSettings(): UserSettings {
  return {
    home_layout: [],
    hidden_nav_items: [],
    launcher_link_ids: [],
    calendar_view: 'week',
    work_filter: defaultWorkFilter(),
    week_one_start: null,
  }
}

/** Clamps to a valid span, defaulting to 1 for anything unparseable. */
export function clampSpan(span: unknown): HomeWidgetSpan {
  const n = typeof span === 'number' ? span : Number(span)
  if (!Number.isFinite(n)) return 1
  return Math.min(4, Math.max(1, Math.round(n))) as HomeWidgetSpan
}

function isPlainHomeLayoutEntry(value: unknown): value is { id: string; span?: unknown; hidden?: unknown; height?: unknown } {
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
    entries.push(withHeight({ id: item.id, span: clampSpan(item.span), hidden: Boolean(item.hidden) }, item.height))
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
    | {
        home_layout?: unknown
        hidden_nav_items?: unknown
        launcher_link_ids?: unknown
        calendar_view?: unknown
        work_filter?: unknown
        week_one_start?: unknown
      }
    | null
    | undefined
): UserSettings {
  if (!row) return defaultSettings()
  return {
    home_layout: parseHomeLayout(row.home_layout),
    hidden_nav_items: parseStringArray(row.hidden_nav_items),
    launcher_link_ids: parseStringArray(row.launcher_link_ids),
    calendar_view: parseCalendarView(row.calendar_view),
    work_filter: parseWorkFilter(row.work_filter),
    week_one_start: parseWeekOneStart(row.week_one_start),
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
    merged.push(withHeight({ id: entry.id, span: clampSpan(entry.span), hidden: Boolean(entry.hidden) }, entry.height))
  }
  for (const id of knownIds) {
    if (!seen.has(id)) merged.push({ id, span: 1, hidden: false })
  }
  return merged
}
