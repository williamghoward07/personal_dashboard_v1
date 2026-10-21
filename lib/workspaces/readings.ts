import type { WorkspaceLink } from '@/lib/types'

// Weekly readings: workspace_links rows with a `week` (1..52). Everything
// else on the page treats week-less links as "sources". Pure so progress
// and grouping are testable.

export const MAX_WEEK = 52
// The week picker always offers at least this many weeks (a UK term).
const MIN_WEEK_OPTIONS = 12

export function isReading(link: Pick<WorkspaceLink, 'week'>): boolean {
  return link.week !== null && link.week !== undefined
}

/** Sources (no week) and readings (with a week), each in input order. */
export function splitReadings<T extends Pick<WorkspaceLink, 'week'>>(links: T[]): { sources: T[]; readings: T[] } {
  const sources: T[] = []
  const readings: T[] = []
  for (const link of links) (isReading(link) ? readings : sources).push(link)
  return { sources, readings }
}

export interface ReadingProgress {
  done: number
  total: number
  percent: number
}

export function readingProgress(readings: Pick<WorkspaceLink, 'completed_at'>[]): ReadingProgress {
  const done = readings.filter((r) => r.completed_at).length
  const total = readings.length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export interface WeekGroup<T> {
  week: number
  links: T[]
  progress: ReadingProgress
}

/** Readings grouped by week (ascending), each group in position order. */
export function groupByWeek<T extends Pick<WorkspaceLink, 'week' | 'position' | 'completed_at'>>(
  readings: T[]
): WeekGroup<T>[] {
  const byWeek = new Map<number, T[]>()
  for (const reading of readings) {
    if (!isReading(reading)) continue
    const week = reading.week as number
    const group = byWeek.get(week)
    if (group) group.push(reading)
    else byWeek.set(week, [reading])
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, links]) => {
      const sorted = [...links].sort((a, b) => a.position - b.position)
      return { week, links: sorted, progress: readingProgress(sorted) }
    })
}

/** The latest week with readings — where a new reading goes by default. */
export function defaultWeek(readings: Pick<WorkspaceLink, 'week'>[]): number {
  return readings.reduce((max, r) => Math.max(max, r.week ?? 0), 0) || 1
}

/** Weeks to offer in a picker: 1..max(12, latest + 1), capped at 52. */
export function weekOptions(readings: Pick<WorkspaceLink, 'week'>[]): number[] {
  const latest = readings.reduce((max, r) => Math.max(max, r.week ?? 0), 0)
  const count = Math.min(MAX_WEEK, Math.max(MIN_WEEK_OPTIONS, latest + 1))
  return Array.from({ length: count }, (_, i) => i + 1)
}
