import type { CSSProperties } from 'react'
import type { Task, ActivitySession, RoutineInstance } from '@/lib/types'
import { londonDateKey } from '@/lib/google/london-day'
import { ACCENT_BAR, ACCENT_VAR } from '@/lib/theme'
import { POST_ACCENT, PREP_ACCENT } from '@/lib/timetable/format'
import { calendarEventSession, calendarEventUid, type SessionWithPrep, type TrackedPrep } from '@/lib/timetable/session'

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
      // Only set alongside `start` (the event's first day) — an hour-grid
      // needs real duration for pill height. A timed event that crosses
      // midnight has no `start`/`end` on its later day-entries (same
      // limitation `start` already had), so it falls back to rendering as
      // untimed there rather than splitting across the day boundary.
      end: string | null
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
  | {
      // A timetable session (lecture, seminar…) from the ICS feed, or a
      // Google event with prep tracked, coloured by its split traffic
      // light. Clicking one opens SessionPopover.
      kind: 'session'
      id: string
      title: string
      start: string
      end: string | null
      session: SessionWithPrep
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
  session: 'bg-on-surface-variant',
}

/** The dot class for any item: a session's is its traffic light. */
export function dotClassFor(item: DayItem): string {
  return item.kind === 'session' ? ACCENT_BAR[PREP_ACCENT[item.session.status]] : DOT_CLASS[item.kind]
}

/**
 * A session pill split down the middle: prep before on the left half,
 * follow-up after on the right, each tinted and edged in its light's colour.
 */
/**
 * One border colour as its four longhands, for pills that can turn into a
 * session pill in place (tracking a Google event). Mixing the `borderColor`
 * shorthand with longhands on one element makes React warn.
 */
export function borderColors(colour: string): CSSProperties {
  return { borderTopColor: colour, borderRightColor: colour, borderBottomColor: colour, borderLeftColor: colour }
}

export function sessionPillStyle(session: SessionWithPrep): CSSProperties {
  const prep = ACCENT_VAR[PREP_ACCENT[session.status]]
  const post = ACCENT_VAR[POST_ACCENT[session.postStatus]]
  const tint = (colour: string) => `color-mix(in srgb, ${colour} 16%, transparent)`
  const edge = `color-mix(in srgb, ${prep} 50%, ${post})`
  // Longhands only: React warns when a shorthand (`borderColor`,
  // `background`) is mixed with its longhands across re-renders.
  return {
    backgroundImage: `linear-gradient(90deg, ${tint(prep)} 50%, ${tint(post)} 50%)`,
    borderTopColor: edge,
    borderBottomColor: edge,
    borderLeftColor: prep,
    borderRightColor: post,
    borderLeftWidth: 3,
    borderRightWidth: 3,
  }
}

/** "Lecture: Physical Geography" — short enough for a grid cell. A tracked event keeps its own title. */
export function sessionItemTitle(session: SessionWithPrep): string {
  return session.source === 'calendar' ? session.title : `${session.type}: ${session.moduleName}`
}

/** An untracked timed Google event as a session, to open its popover (and its "track prep" switch). */
export function calendarItemSession(item: Extract<DayItem, { kind: 'calendar' }>): SessionWithPrep | null {
  if (item.allDay || !item.start) return null
  return calendarEventSession({ id: item.id, title: item.title, start: item.start, end: item.end }, null, new Date())
}

export function formatSpanEnd(endKey: string) {
  return new Date(`${endKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
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
// (see getBarSpans) and filter these per-day entries out (see
// isBarRenderedCalendarItem) to avoid showing it twice.
//
// A Google event with prep tracked (`tracked`, by `gcal:` uid) becomes a
// 'session' item instead, so it gets the traffic light — only a same-day
// timed event; an all-day or multi-day one stays a bar.
//
// A scheduled routine writes both a routine_instances row AND a real Google
// Calendar event (see app/api/routines/schedule) — Google events whose id
// matches a routine instance's google_event_id are dropped here so the same
// block never renders twice (once generic, once routine-specific).
export function groupItemsByDate(
  events: CalendarEvent[],
  tasks: Task[],
  sessions: ActivitySession[],
  routineInstances: RoutineInstance[],
  timetable: SessionWithPrep[] = [],
  tracked: Map<string, TrackedPrep> = new Map(),
  now: Date = new Date()
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
    const prep = !event.allDay && startKey === endKey ? tracked.get(calendarEventUid(event.id)) : undefined
    if (prep) {
      const session = calendarEventSession(event, prep, now)
      push(startKey, {
        kind: 'session',
        id: session.uid,
        title: sessionItemTitle(session),
        start: session.start,
        end: session.end,
        session,
      })
      continue
    }
    for (const key of keysBetween(startKey, endKey)) {
      const isFirstDayTimed = !event.allDay && key === startKey
      push(key, {
        kind: 'calendar',
        id: event.id,
        title: event.title,
        allDay: event.allDay,
        // Only the first day carries a real time — later days are just a
        // continuation, nothing "starts" there.
        start: isFirstDayTimed ? event.start : null,
        end: isFirstDayTimed ? event.end : null,
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

  for (const session of timetable) {
    push(londonDateKey(session.start), {
      kind: 'session',
      id: session.uid,
      title: sessionItemTitle(session),
      start: session.start,
      end: session.end,
      session,
    })
  }

  for (const items of byDate.values()) {
    items.sort((a, b) => {
      const aStart = a.kind === 'calendar' || a.kind === 'routine' || a.kind === 'session' ? a.start : null
      const bStart = b.kind === 'calendar' || b.kind === 'routine' || b.kind === 'session' ? b.start : null
      if (!aStart && !bStart) return 0
      if (!aStart) return -1
      if (!bStart) return 1
      return aStart.localeCompare(bStart)
    })
  }

  return byDate
}

// All-day events — single-day or multi-day — and any timed event that
// crosses more than one day are rendered as a blocked-out bar across the
// month/week grid instead of a dot+title row, so a multi-day commitment
// reads as one continuous span the way it does on the calendar itself. A
// same-day timed event stays in the compact per-day list with its time
// shown.
export function getBarSpans(events: CalendarEvent[]): EventSpan[] {
  return events
    .map((event) => ({ event, ...resolveEventSpan(event) }))
    .filter(({ event, startKey, endKey }) => event.allDay || startKey !== endKey)
    .map(({ event, startKey, endKey }) => ({ id: event.id, title: event.title, startKey, endKey }))
}

// True for a 'calendar' DayItem that's already rendered as a spanning bar
// (see getBarSpans above) — used to filter such items out of the ordinary
// per-day list/pill rendering so they don't also show up there.
export function isBarRenderedCalendarItem(item: DayItem): boolean {
  return item.kind === 'calendar' && (item.allDay || item.spanStartKey !== item.spanEndKey)
}
