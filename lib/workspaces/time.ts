import type { WorkspaceTimeLog } from '@/lib/types'
import { londonDayBoundsUTC, londonWeekBoundsUTC } from '@/lib/google/london-day'

// Study time logged on a workspace by hand (e.g. from Opal sessions). Most
// entries are 15-minute blocks, but any whole number of minutes is allowed.
// Days are Europe/London calendar days; weeks run Monday to Sunday.

/** The quick-pick chips, in minutes. */
export const QUICK_MINUTES = [15, 30, 45, 60, 90, 120, 180] as const
export const MAX_MINUTES_PER_ENTRY = 1440

/** 45 → "45m", 60 → "1h", 105 → "1h 45m", 0 → "0m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * Reads a typed duration: "50", "50m", "1:35", "1h35", "1h 35m", "1.5h",
 * "2h". Returns whole minutes (1..1440), or null if it can't be read.
 */
export function parseMinutesInput(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return null
  let minutes: number | null = null

  const clock = text.match(/^(\d+):(\d{1,2})$/)
  const hm = text.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m?)?$/)
  if (clock) {
    const mins = Number(clock[2])
    if (mins < 60) minutes = Number(clock[1]) * 60 + mins
  } else if (hm && (hm[1] || hm[2])) {
    // A bare number is minutes; "1.5h" is hours.
    minutes = Math.round((hm[1] ? Number(hm[1]) * 60 : 0) + (hm[2] ? Number(hm[2]) : 0))
  }

  if (minutes === null || !Number.isFinite(minutes) || minutes < 1 || minutes > MAX_MINUTES_PER_ENTRY) return null
  return minutes
}

export function totalMinutes(logs: Pick<WorkspaceTimeLog, 'minutes'>[]): number {
  return logs.reduce((sum, log) => sum + log.minutes, 0)
}

function inRange(day: string, startKey: string, endKeyExclusive: string): boolean {
  return day >= startKey && day < endKeyExclusive
}

export interface TimeSummary {
  thisWeek: number
  lastWeek: number
  total: number
  /** Distinct days with time logged this week. */
  daysThisWeek: number
}

export function timeSummary(logs: Pick<WorkspaceTimeLog, 'day' | 'minutes'>[], now = new Date()): TimeSummary {
  const week = londonWeekBoundsUTC(now)
  const previous = londonWeekBoundsUTC(new Date(now.getTime() - 7 * 86_400_000))
  const thisWeekLogs = logs.filter((l) => inRange(l.day, week.startDateKey, week.endDateKey))
  return {
    thisWeek: totalMinutes(thisWeekLogs),
    lastWeek: totalMinutes(logs.filter((l) => inRange(l.day, previous.startDateKey, previous.endDateKey))),
    total: totalMinutes(logs),
    daysThisWeek: new Set(thisWeekLogs.map((l) => l.day)).size,
  }
}

/**
 * The ring on the Study time card: this week against the weekly target,
 * or against last week when no target is set. 0..100.
 */
export function weekRingPercent(summary: TimeSummary, targetMinutes: number | null): number {
  const goal = targetMinutes ?? summary.lastWeek
  if (!goal) return summary.thisWeek > 0 ? 100 : 0
  return Math.min(100, Math.round((summary.thisWeek / goal) * 100))
}

/** Today's London date key — the default day for a new entry. */
export function todayKey(now = new Date()): string {
  return londonDayBoundsUTC(now).startDateKey
}

/** This week's entries, newest day first (then newest entry). */
export function entriesThisWeek<T extends Pick<WorkspaceTimeLog, 'day' | 'created_at'>>(logs: T[], now = new Date()): T[] {
  const week = londonWeekBoundsUTC(now)
  return logs
    .filter((l) => inRange(l.day, week.startDateKey, week.endDateKey))
    .sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at))
}
