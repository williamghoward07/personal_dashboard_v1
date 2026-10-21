import type { WorkspaceLink } from '@/lib/types'

// A just-ticked source stays in the main list (greyed) for this long before
// it drops into the Completed sublist.
export const RECENTLY_COMPLETED_MS = 5000

export function isOpenLink(link: Pick<WorkspaceLink, 'completed_at'>): boolean {
  return !link.completed_at
}

// Splits sources into the main list and the Completed sublist, keeping
// position order. `recentIds` are sources ticked in the last few seconds —
// they stay in `open` so the row can grey out in place before moving.
export function partitionLinks(
  links: WorkspaceLink[],
  recentIds: ReadonlySet<string>
): { open: WorkspaceLink[]; completed: WorkspaceLink[] } {
  const open: WorkspaceLink[] = []
  const completed: WorkspaceLink[] = []
  for (const link of links) {
    if (!link.completed_at || recentIds.has(link.id)) open.push(link)
    else completed.push(link)
  }
  return { open, completed }
}
