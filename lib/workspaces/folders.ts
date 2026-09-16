import type { Accent } from '@/lib/theme'
import type { Workspace, WorkspaceFolder } from '@/lib/types'

// Pure helpers for nested workspace folders. Every walk up or down the
// tree tracks visited ids, so a malformed (cyclic) row set can never loop
// forever — the DB rejects cycles, this is belt and braces.

export const DEFAULT_WORKSPACE_ACCENT: Accent = 'teal'

// The colours offered for workspaces and their folders (lib/theme.ts's
// Accent keys; the DB check constraint allows the same set).
export const WORKSPACE_ACCENTS: Accent[] = ['teal', 'mint', 'blue', 'orange', 'pink', 'purple', 'amber', 'crimson', 'neutral']

type FolderNode = Pick<WorkspaceFolder, 'id' | 'parent_id' | 'color'>

export function isAccent(value: string | null | undefined): value is Accent {
  return !!value && (WORKSPACE_ACCENTS as string[]).includes(value)
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

/** Root-first chain of folders from the top level down to `folderId` (inclusive). */
export function folderPath<T extends FolderNode>(folders: T[], folderId: string | null): T[] {
  const lookup = byId(folders)
  const path: T[] = []
  const seen = new Set<string>()
  let current = folderId ? lookup.get(folderId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parent_id ? lookup.get(current.parent_id) : undefined
  }
  return path
}

/** `folderId` plus every folder nested anywhere beneath it. */
export function descendantIds(folders: FolderNode[], folderId: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const folder of folders) {
    if (!folder.parent_id) continue
    const list = children.get(folder.parent_id) ?? []
    list.push(folder.id)
    children.set(folder.parent_id, list)
  }
  const result = new Set<string>()
  const stack = [folderId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (result.has(id)) continue
    result.add(id)
    stack.push(...(children.get(id) ?? []))
  }
  return result
}

/** Direct child folders of `parentId` (null = top level), in display order. */
export function childFolders<T extends Pick<WorkspaceFolder, 'parent_id' | 'sort_order' | 'name'>>(
  folders: T[],
  parentId: string | null
): T[] {
  return folders
    .filter((f) => (f.parent_id ?? null) === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

/** Workspaces anywhere under a folder (archived excluded), and subfolders directly inside it. */
export function folderCounts(
  folders: FolderNode[],
  workspaces: Pick<Workspace, 'folder_id' | 'archived_at'>[],
  folderId: string
): { workspaces: number; subfolders: number } {
  const subtree = descendantIds(folders, folderId)
  return {
    workspaces: workspaces.filter((w) => !w.archived_at && w.folder_id !== null && subtree.has(w.folder_id)).length,
    subfolders: folders.filter((f) => f.parent_id === folderId).length,
  }
}

/** The nearest colour set on `folderId` or any folder above it. */
export function resolveFolderAccent(folders: FolderNode[], folderId: string | null): Accent | null {
  const path = folderPath(folders, folderId)
  for (let i = path.length - 1; i >= 0; i--) {
    if (isAccent(path[i].color)) return path[i].color as Accent
  }
  return null
}

/** workspace.color -> nearest coloured ancestor folder -> teal. */
export function resolveAccent(
  workspace: Pick<Workspace, 'color' | 'folder_id'>,
  folders: FolderNode[]
): Accent {
  if (isAccent(workspace.color)) return workspace.color
  return resolveFolderAccent(folders, workspace.folder_id) ?? DEFAULT_WORKSPACE_ACCENT
}

export interface MoveTarget {
  id: string | null
  label: string
  depth: number
}

/**
 * Every place something can be moved to, as an indented list: the top
 * level, then each folder depth-first. When moving a folder, that folder
 * and everything beneath it are left out (it can't go inside itself).
 */
export function moveTargets(
  folders: (FolderNode & Pick<WorkspaceFolder, 'name' | 'sort_order'>)[],
  movingFolderId: string | null = null
): MoveTarget[] {
  const excluded = movingFolderId ? descendantIds(folders, movingFolderId) : new Set<string>()
  const targets: MoveTarget[] = [{ id: null, label: 'Top level', depth: 0 }]
  const visit = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const folder of childFolders(folders, parentId)) {
      if (excluded.has(folder.id) || seen.has(folder.id)) continue
      seen.add(folder.id)
      targets.push({ id: folder.id, label: folder.name, depth })
      visit(folder.id, depth + 1, seen)
    }
  }
  visit(null, 1, new Set())
  return targets
}
