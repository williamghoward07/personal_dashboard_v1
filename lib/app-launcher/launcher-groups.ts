import type { LinkFolder, QuickLink } from '@/lib/types'

export type LauncherLink = QuickLink & { folder?: LinkFolder | null }
export type LauncherItem =
  | { type: 'link'; link: LauncherLink }
  | { type: 'folder'; folder: LinkFolder; links: LauncherLink[] }

/** Group selected links at the position of the folder's first selected link. */
export function groupLauncherLinks(links: readonly LauncherLink[]): LauncherItem[] {
  const items: LauncherItem[] = []
  const groups = new Map<string, Extract<LauncherItem, { type: 'folder' }>>()
  for (const link of links) {
    if (link.archived_at || link.folder?.archived_at) continue
    if (!link.folder_id || !link.folder || link.folder.id !== link.folder_id) {
      items.push({ type: 'link', link })
      continue
    }
    let group = groups.get(link.folder_id)
    if (!group) {
      group = { type: 'folder', folder: link.folder, links: [] }
      groups.set(link.folder_id, group)
      items.push(group)
    }
    group.links.push(link)
  }
  return items
}
