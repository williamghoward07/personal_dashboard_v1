// Pure logic for the home App Launcher widget: which quick_links appear and
// in what order (`user_settings.launcher_link_ids` — the single ordered
// array that is now the launcher's only source of truth, see CLAUDE.md's
// App Library section on the retired `quick_links.is_pinned`). Framework-agnostic, no Supabase import —
// same house style as lib/app-launcher/order.ts.

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
