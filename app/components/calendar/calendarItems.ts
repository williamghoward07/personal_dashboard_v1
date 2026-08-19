import type { Task, ActivitySession, RoutineInstance } from '@/lib/types'
import { londonDateKey } from '@/lib/google/london-day'

export interface CalendarEvent {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string | null
}

export type DayItem =
  | {
      kind: 'calendar'
      id: string
      title: string
      allDay: boolean
      start: string | null
      // Equal for a single-day event. Multi-day events appear once per day
      // they cover, both keys shared across every one of those entries, so
      // callers can tell "this is part of a longer span" and show the range.
      spanStartKey: string
      spanEndKey: string
    }
  | { kind: 'task'; id: string; title: string; task: Task }
  | { kind: 'activity'; id: string; title: string }
  | {
      kind: 'routine'
      id: string
      title: string
      start: string
      durationMinutes: number
      colour: string
      routineId: string | null
      instance: RoutineInstance
    }

export interface EventSpan {
  id: string
  title: string
  startKey: string
  endKey: string // inclusive
}

// Same source → colour mapping as CalendarModule's home-page widget, so the
// dedicated page reads as the same system. 'routine' isn't actually rendered
// via this map — each routine has its own user-picked colour, applied
// inline by the caller — this entry only exists so the Record stays total.
export const DOT_CLASS: Record<DayItem['kind'], string> = {
  calendar: 'bg-on-surface-variant',
  task: 'bg-academic-orange',
  activity: 'bg-primary-container',
  routine: 'bg-habit-purple',
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

export function addDaysToKey(key: string, delta: number): string {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function keysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = []
  for (let key = startKey; key <= endKey; key = addDaysToKey(key, 1)) keys.push(key)
  return keys
}

// Which Europe/London calendar days an event occupies, inclusive. All-day
// events carry an exclusive `end` date per Google's API (the day *after*
// the last day); timed events ending exactly at London midnight likewise
// don't actually occupy that following day.
function resolveEventSpan(event: CalendarEvent): { startKey: string; endKey: string } {
  const startKey = event.allDay ? event.start.slice(0, 10) : londonDateKey(event.start)

  if (!event.end) return { startKey, endKey: startKey }

  if (event.allDay) {
    const endKey = addDaysToKey(event.end.slice(0, 10), -1)
    return { startKey, endKey: endKey < startKey ? startKey : endKey }
  }

  const endsAtLondonMidnight =
    new Date(event.end).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Europe/London' }) === '00:00:00'
  const endKey = londonDateKey(event.end)
  const adjustedEndKey = endsAtLondonMidnight ? addDaysToKey(endKey, -1) : endKey
  return { startKey, endKey: adjustedEndKey < startKey ? startKey : adjustedEndKey }
}

// Buckets Google Calendar events, tasks (by due date), activity sessions,
// and scheduled routine instances into one map keyed by 'YYYY-MM-DD'. A
// multi-day event appears under every date it spans (annotated with
// spanStartKey/spanEndKey) so day/agenda views can show it wherever it's
// relevant; month/week grid views instead render it once as a spanning bar
// (see getMultiDayEventSpans) and filter these per-day entries out to avoid
// showing it twice.
//
// A scheduled routine writes both a routine_instances row AND a real Google
// Calendar event (see app/api/routines/schedule) — Google events whose id
// matches a routine instance's google_event_id are dropped here so the same
// block never renders twice (once generic, once routine-specific).
export function groupItemsByDate(
  events: CalendarEvent[],
  tasks: Task[],
  sessions: ActivitySession[],
  routineInstances: RoutineInstance[]
): Map<string, DayItem[]> {
  const byDate = new Map<string, DayItem[]>()
  const routineEventIds = new Set(routineInstances.map((i) => i.google_event_id))

  const push = (key: string, item: DayItem) => {
    const existing = byDate.get(key)
    if (existing) existing.push(item)
    else byDate.set(key, [item])
  }

  for (const event of events) {
    if (routineEventIds.has(event.id)) continue

    const { startKey, endKey } = resolveEventSpan(event)
    for (const key of keysBetween(startKey, endKey)) {
      push(key, {
        kind: 'calendar',
        id: event.id,
        title: event.title,
        allDay: event.allDay,
        // Only the first day carries a real time — later days are just a
        // continuation, nothing "starts" there.
        start: !event.allDay && key === startKey ? event.start : null,
        spanStartKey: startKey,
        spanEndKey: endKey,
      })
    }
  }

  for (const task of tasks) {
    if (!task.due_date) continue
    push(task.due_date, { kind: 'task', id: task.id, title: task.title, task })
  }

  for (const session of sessions) {
    push(londonDateKey(session.occurred_at), {
      kind: 'activity',
      id: session.id,
      title: `${session.activity_type}${session.duration_minutes ? ` — ${session.duration_minutes}m` : ''}`,
    })
  }

  for (const instance of routineInstances) {
    push(londonDateKey(instance.start_at), {
      kind: 'routine',
      id: instance.id,
      title: instance.routine_name,
      start: instance.start_at,
      durationMinutes: instance.duration_minutes,
      colour: instance.routine_colour,
      routineId: instance.routine_id,
      instance,
    })
  }

  for (const items of byDate.values()) {
    items.sort((a, b) => {
      const aStart = a.kind === 'calendar' || a.kind === 'routine' ? a.start : null
      const bStart = b.kind === 'calendar' || b.kind === 'routine' ? b.start : null
      if (!aStart && !bStart) return 0
      if (!aStart) return -1
      if (!bStart) return 1
      return aStart.localeCompare(bStart)
    })
  }

  return byDate
}

// All-day events — single-day or multi-day — rendered as a blocked-out bar
// across the month/week grid instead of a dot+title row, so a whole day
// reads as "blocked" the way it does on the calendar itself. Timed events
// never become bars: they stay in the compact per-day list with their time
// shown, regardless of how many days they technically touch.
export function getAllDayEventSpans(events: CalendarEvent[]): EventSpan[] {
  return events
    .filter((event) => event.allDay)
    .map((event) => {
      const { startKey, endKey } = resolveEventSpan(event)
      return { id: event.id, title: event.title, startKey, endKey }
    })
}
