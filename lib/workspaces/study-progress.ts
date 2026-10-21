import type { WorkspaceLink, WorkspaceTimeLog } from '@/lib/types'
import { readingProgress, type ReadingProgress } from './readings'

// Per-workspace readings progress and this week's study time, for the
// workspace cards on /workspaces — so a folder like "Year 1 modules" shows
// every module's progress side by side.

export interface StudyProgress {
  readings: ReadingProgress
  minutesThisWeek: number
}

export function studyProgressByWorkspace(
  readings: Pick<WorkspaceLink, 'workspace_id' | 'completed_at'>[],
  logsThisWeek: Pick<WorkspaceTimeLog, 'workspace_id' | 'minutes'>[]
): Map<string, StudyProgress> {
  const readingsBy = new Map<string, Pick<WorkspaceLink, 'completed_at'>[]>()
  for (const r of readings) {
    const list = readingsBy.get(r.workspace_id)
    if (list) list.push(r)
    else readingsBy.set(r.workspace_id, [r])
  }
  const minutesBy = new Map<string, number>()
  for (const log of logsThisWeek) minutesBy.set(log.workspace_id, (minutesBy.get(log.workspace_id) ?? 0) + log.minutes)

  const ids = new Set([...readingsBy.keys(), ...minutesBy.keys()])
  return new Map(
    [...ids].map((id) => [
      id,
      { readings: readingProgress(readingsBy.get(id) ?? []), minutesThisWeek: minutesBy.get(id) ?? 0 },
    ])
  )
}
