import ICAL from 'ical.js'
import { parseSessionTitle, type TimetableSession } from './session'

// Parses an ICS feed into sessions, sorted by start. Pure (no fetch) so it
// is testable against a fixture. MyTimetable gives every occurrence its own
// VEVENT and UID; recurring events are still expanded (up to a cap) in case
// a feed uses RRULE, keyed `${uid}#${occurrence start}` so each occurrence
// has its own identity. Cancelled events are dropped.

const MAX_OCCURRENCES = 200

export function parseIcs(text: string): TimetableSession[] {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)

  const vevents = root.getAllSubcomponents('vevent')
  const overrides = vevents.filter((v) => v.hasProperty('recurrence-id'))

  const sessions: TimetableSession[] = []
  for (const vevent of vevents) {
    const status = String(vevent.getFirstPropertyValue('status') ?? '').toUpperCase()
    if (status === 'CANCELLED') continue
    // Overrides of a recurring event are applied through the master below.
    if (vevent.hasProperty('recurrence-id')) continue

    const event = new ICAL.Event(vevent)
    if (!event.uid || !event.startDate) continue
    const title = (event.summary ?? '').trim() || '(No title)'
    const base = {
      title,
      ...parseSessionTitle(title),
      location: event.location?.trim() || null,
    }

    if (!event.isRecurring()) {
      sessions.push({
        uid: event.uid,
        ...base,
        start: event.startDate.toJSDate().toISOString(),
        end: event.endDate ? event.endDate.toJSDate().toISOString() : null,
      })
      continue
    }

    for (const override of overrides) {
      if (override.getFirstPropertyValue('uid') === event.uid) event.relateException(override)
    }
    const iterator = event.iterator()
    for (let i = 0, next = iterator.next(); next && i < MAX_OCCURRENCES; i++, next = iterator.next()) {
      const details = event.getOccurrenceDetails(next)
      const start = details.startDate.toJSDate().toISOString()
      sessions.push({
        uid: `${event.uid}#${start}`,
        ...base,
        start,
        end: details.endDate ? details.endDate.toJSDate().toISOString() : null,
      })
    }
  }

  return sessions.sort((a, b) => a.start.localeCompare(b.start))
}

/** Sessions overlapping [timeMin, timeMax). */
export function sessionsInRange(sessions: TimetableSession[], timeMin: string, timeMax: string): TimetableSession[] {
  const min = new Date(timeMin).getTime()
  const max = new Date(timeMax).getTime()
  return sessions.filter((s) => {
    const start = new Date(s.start).getTime()
    const end = new Date(s.end ?? s.start).getTime()
    return start < max && end >= min
  })
}
