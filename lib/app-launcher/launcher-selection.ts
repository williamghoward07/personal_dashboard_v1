// Pure logic for the home App Launcher widget: which quick_links appear and
// in what order (`user_settings.launcher_link_ids` — the single ordered
// array that is now the launcher's only source of truth, see CLAUDE.md's
// App Library section on the retired `quick_links.is_pinned`), plus how many
// tiles a given widget span shows. Framework-agnostic, no Supabase import —
// same house style as lib/app-launcher/order.ts.

import type { HomeWidgetSpan } from '@/lib/settings/schema'

export interface SeedableLink {
  id: string
  is_pinned: boolean
  sort_order: number
}

/**
 * Resolves a stored id array against the links that actually exist,
 * dropping stale ids (a link deleted since the array was last saved) and
 * duplicates, while preserving the stored order.
 */
export function resolveLauncherIds(
  ids: readonly string[],
  availableIds: ReadonlySet<string> | readonly string[]
): string[] {
  const available = availableIds instanceof Set ? availableIds : new Set(availableIds)
  const seen = new Set<string>()
  const resolved: string[] = []
  for (const id of ids) {
    if (!available.has(id) || seen.has(id)) continue
    seen.add(id)
    resolved.push(id)
  }
  return resolved
}

/**
 * What a user with no `launcher_link_ids` yet should see: the ids of the
 * (retired) `is_pinned` links, in `sort_order`. Seeded once, client-side,
 * only when there is something worth seeding from — an empty result here
 * (no pinned links) is not itself written anywhere, so a later deliberate
 * "remove everything" is never mistaken for "never seeded".
 */
export function seedLauncherIds(links: readonly SeedableLink[]): string[] {
  return links
    .filter((link) => link.is_pinned)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => link.id)
}

/** Adds/removes one id from the selection — the menu's visibility toggle. */
export function toggleLauncherLink(ids: readonly string[], linkId: string): string[] {
  return ids.includes(linkId) ? ids.filter((id) => id !== linkId) : [...ids, linkId]
}

/**
 * Moves `activeId` to sit where `overId` currently is. Same splice-based
 * algorithm as `@dnd-kit/sortable`'s `arrayMove` (kept dependency-free here
 * since this module has no framework imports); unknown ids or a no-op drag
 * return a shallow copy of `ids` unchanged.
 */
export function reorderLauncherIds(ids: readonly string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from === -1 || to === -1 || from === to) return [...ids]
  const next = ids.slice()
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

// Tailwind only generates classes it can see written out in full — same
// pattern as lib/workspaces/layout.ts's COLUMN_GRID_CLASS. Columns scale
// with span so a wider widget shows more apps at roughly the same tile
// size, while the row count (below) stays fixed so the widget's height
// doesn't balloon at wide spans.
export const LAUNCHER_GRID_COLS_CLASS: Record<HomeWidgetSpan, string> = {
  1: 'grid-cols-4',
  2: 'grid-cols-8',
  3: 'grid-cols-12',
  4: 'grid-cols-[repeat(16,minmax(0,1fr))]',
}

const LAUNCHER_COLUMNS: Record<HomeWidgetSpan, number> = { 1: 4, 2: 8, 3: 12, 4: 16 }
const LAUNCHER_ROWS = 2

/**
 * How many app tiles a launcher of this span shows, leaving one slot free
 * for the ever-present "More" tile. 7 at span 1 — matching the old
 * `MAX_TILES` exactly, so a default-span widget looks the same as before
 * this change.
 */
export function tilesForSpan(span: HomeWidgetSpan): number {
  return LAUNCHER_COLUMNS[span] * LAUNCHER_ROWS - 1
}
