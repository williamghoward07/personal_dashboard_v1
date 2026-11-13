// Display helpers for the work list. Pure: everything is in Europe/London,
// never the machine's timezone.

import { daysBetween } from '@/lib/blackboard/dates'
import { londonDateKey } from '@/lib/google/london-day'
import type { BbProcessing } from '@/lib/blackboard/use-bb-processing'
import type { SyncState } from '@/lib/blackboard/work'

const TZ = 'Europe/London'

/** "Mon 19 Oct" for a London day key. */
export function formatDueDay(dueOn: string): string {
  // Noon UTC is the same calendar day in London all year round.
  return new Date(`${dueOn}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** 'HH:MM' on the London wall clock. */
export function londonTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

/**
 * The time to show beside a due day: only when `dueAt` is on that same
 * London day (a `dueAt` left on another day is stale, so the day wins).
 */
export function dueTimeLabel(dueOn: string | null, dueAt: string | null): string | null {
  if (!dueOn || !dueAt) return null
  return londonDateKey(dueAt) === dueOn ? londonTime(dueAt) : null
}

/** "today", "tomorrow", "in 3 days", "1 day overdue", "2 days overdue". */
export function relativeDueLabel(dueOn: string, today: string): string {
  const days = daysBetween(today, dueOn)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1) return `in ${days} days`
  return days === -1 ? '1 day overdue' : `${-days} days overdue`
}

/** "just now", "5 min ago", "2 h ago", "1 day ago", "3 days ago". */
export function formatAge(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

export type SyncTone = 'ok' | 'warn' | 'bad'

const SYNC_HINT = 'Open Blackboard to sync.'

/** The sync line: "Synced 2 h ago", "Last synced 3 days ago. Open Blackboard to sync.", … */
export function syncLabel(state: SyncState, lastOkAt: string | null, now: Date): { text: string; tone: SyncTone } {
  switch (state) {
    case 'fresh':
      return { text: lastOkAt ? `Synced ${formatAge(lastOkAt, now)}` : 'Synced', tone: 'ok' }
    case 'stale':
      return {
        text: lastOkAt ? `Last synced ${formatAge(lastOkAt, now)}. ${SYNC_HINT}` : `Never synced. ${SYNC_HINT}`,
        tone: 'warn',
      }
    case 'failed':
      return { text: 'Last sync failed', tone: 'bad' }
    case 'never':
      return { text: `Never synced. ${SYNC_HINT}`, tone: 'warn' }
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The AI-reading line, or null when there's nothing to say (idle, disabled,
 * an error shown separately, or a finished run that read nothing). A
 * finished run reads "Read 3 new or changed items of 320, 2 dated tasks found".
 */
export function processingLabel(p: Pick<BbProcessing, 'state' | 'totals' | 'scope' | 'remaining'>): string | null {
  switch (p.state) {
    case 'running':
      return `Reading new items (${p.remaining} left)`
    case 'done': {
      if (p.scope.read <= 0) return null
      const read = `Read ${plural(p.scope.read, 'new or changed item', 'new or changed items')} of ${Math.max(p.scope.total, p.scope.read)}`
      return p.totals.added > 0 ? `${read}, ${plural(p.totals.added, 'dated task', 'dated tasks')} found` : read
    }
    case 'budget':
      return 'AI limit reached for today. It continues tomorrow.'
    default:
      return null
  }
}

export const failedLabel = (failed: number) => `${plural(failed, 'item', 'items')} could not be read`
