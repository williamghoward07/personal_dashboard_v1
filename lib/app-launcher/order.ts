// Pure ordering helpers for the App Library's drag-and-drop.
//
// quick_links.sort_order is a single sequence across every folder (the
// home launcher sorts pinned links by it regardless of folder), so after a
// link drag the whole visible list is renumbered in display order rather
// than numbering each folder 0..n — per-folder numbering would create ties.

export const UNFILED_KEY = 'unfiled'

export interface OrderableLink {
  id: string
  folder_id: string | null
  sort_order: number
}

export interface OrderableFolder {
  id: string
  sort_order: number
}

export interface RowPatch {
  id: string
  patch: { sort_order?: number; folder_id?: string | null }
}

export function folderKeyOf(link: Pick<OrderableLink, 'folder_id'>): string {
  return link.folder_id ?? UNFILED_KEY
}

/** Links grouped by folder key, each group keeping the input array's order. */
export function groupLinks<T extends OrderableLink>(links: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const link of links) {
    const key = folderKeyOf(link)
    const group = groups.get(key)
    if (group) group.push(link)
    else groups.set(key, [link])
  }
  return groups
}

/**
 * Flattens links into display order: folder by folder (in the given folder
 * order), then Unfiled last — the same order the page renders them in.
 */
export function displayOrder<T extends OrderableLink>(links: T[], folderIds: string[]): T[] {
  const groups = groupLinks(links)
  const ordered: T[] = []
  for (const id of folderIds) ordered.push(...(groups.get(id) ?? []))
  ordered.push(...(groups.get(UNFILED_KEY) ?? []))
  // Links pointing at a folder that isn't in the list (shouldn't happen,
  // but never drop a row) go at the very end.
  const known = new Set([...folderIds, UNFILED_KEY])
  for (const [key, group] of groups) if (!known.has(key)) ordered.push(...group)
  return ordered
}

/**
 * Moves one link to sit where `overId` currently is, possibly in another
 * folder (`targetFolderId`). With no `overId` the link is appended to the
 * end of the target folder's group. Returns a new array.
 */
export function moveLink<T extends OrderableLink>(
  links: T[],
  activeId: string,
  targetFolderId: string | null,
  overId: string | null
): T[] {
  const from = links.findIndex((l) => l.id === activeId)
  if (from === -1) return links
  const moved = { ...links[from], folder_id: targetFolderId }
  const rest = links.filter((l) => l.id !== activeId)

  if (overId && overId !== activeId) {
    const overIndex = rest.findIndex((l) => l.id === overId)
    if (overIndex !== -1) {
      // Dragging downwards within the same group lands after the target
      // (matches dnd-kit's arrayMove semantics); otherwise before it.
      const overInOriginal = links.findIndex((l) => l.id === overId)
      const sameGroup = folderKeyOf(links[from]) === folderKeyOf(moved)
      const insertAt = sameGroup && from < overInOriginal ? overIndex + 1 : overIndex
      return [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)]
    }
  }

  const targetKey = folderKeyOf(moved)
  let lastInGroup = -1
  rest.forEach((l, i) => {
    if (folderKeyOf(l) === targetKey) lastInGroup = i
  })
  const insertAt = lastInGroup === -1 ? rest.length : lastInGroup + 1
  return [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)]
}

/** Patches needed to store `ordered` (display order) as sort_order 0..n. */
export function linkOrderPatches(ordered: OrderableLink[], previous: OrderableLink[]): RowPatch[] {
  const before = new Map(previous.map((l) => [l.id, l]))
  const patches: RowPatch[] = []
  ordered.forEach((link, index) => {
    const prev = before.get(link.id)
    const patch: RowPatch['patch'] = {}
    if (!prev || prev.sort_order !== index) patch.sort_order = index
    if (!prev || prev.folder_id !== link.folder_id) patch.folder_id = link.folder_id
    if (Object.keys(patch).length > 0) patches.push({ id: link.id, patch })
  })
  return patches
}

/** Patches needed to store `ordered` folders as sort_order 0..n. */
export function folderOrderPatches(ordered: OrderableFolder[]): RowPatch[] {
  return ordered
    .map((folder, index) => ({ folder, index }))
    .filter(({ folder, index }) => folder.sort_order !== index)
    .map(({ folder, index }) => ({ id: folder.id, patch: { sort_order: index } }))
}

/** Applies patches to local rows (for optimistic state). */
export function applyPatches<T extends { id: string }>(rows: T[], patches: RowPatch[]): T[] {
  const byId = new Map(patches.map((p) => [p.id, p.patch]))
  return rows.map((row) => {
    const patch = byId.get(row.id)
    return patch ? { ...row, ...patch } : row
  })
}
