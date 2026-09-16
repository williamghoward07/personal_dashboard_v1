import type { Workspace } from '@/lib/types'

// Which workspaces the home widget shows: active ones, most recently
// opened first (never-opened ones fall back to their creation time).

export interface SessionStamp {
  workspace_id: string
  started_at: string
}

export interface GlanceRow<W> {
  workspace: W
  lastOpenedAt: string | null
  openActions: number
}

export function rankWorkspacesForGlance<W extends Pick<Workspace, 'id' | 'archived_at' | 'created_at'>>(
  workspaces: W[],
  sessions: SessionStamp[],
  openTodoWorkspaceIds: (string | null)[],
  limit: number
): GlanceRow<W>[] {
  const lastOpened = new Map<string, string>()
  for (const s of sessions) {
    const current = lastOpened.get(s.workspace_id)
    if (!current || s.started_at > current) lastOpened.set(s.workspace_id, s.started_at)
  }

  const openCounts = new Map<string, number>()
  for (const id of openTodoWorkspaceIds) if (id) openCounts.set(id, (openCounts.get(id) ?? 0) + 1)

  return workspaces
    .filter((w) => !w.archived_at)
    .map((w) => ({ workspace: w, lastOpenedAt: lastOpened.get(w.id) ?? null, openActions: openCounts.get(w.id) ?? 0 }))
    .sort((a, b) =>
      (b.lastOpenedAt ?? b.workspace.created_at).localeCompare(a.lastOpenedAt ?? a.workspace.created_at)
    )
    .slice(0, limit)
}
