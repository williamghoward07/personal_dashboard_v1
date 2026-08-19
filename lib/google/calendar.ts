import 'server-only'
import { getValidGoogleAccessToken } from './token'
import { londonDayBoundsUTC } from './london-day'

export interface CalendarEvent {
  id: string
  title: string
  allDay: boolean
  start: string
  end: string | null
}

interface GoogleEventDateTime {
  date?: string
  dateTime?: string
}

interface GoogleCalendarEvent {
  id: string
  summary?: string
  start?: GoogleEventDateTime
  end?: GoogleEventDateTime
}

export async function fetchTodayGoogleCalendarEvents(): Promise<CalendarEvent[]> {
  const { timeMin, timeMax } = londonDayBoundsUTC()
  return fetchGoogleCalendarEvents(timeMin, timeMax)
}

// Shared by the day/week/month calendar views — one Calendar API call per
// range rather than one per day.
export async function fetchGoogleCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const accessToken = await getValidGoogleAccessToken()

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`)
  }

  const json = (await res.json()) as { items?: GoogleCalendarEvent[] }

  return (json.items ?? [])
    .map((item): CalendarEvent | null => {
      const start = item.start?.dateTime ?? item.start?.date
      if (!start) return null
      return {
        id: item.id,
        title: item.summary?.trim() || '(No title)',
        allDay: Boolean(item.start?.date && !item.start?.dateTime),
        start,
        end: item.end?.dateTime ?? item.end?.date ?? null,
      }
    })
    .filter((event): event is CalendarEvent => event !== null)
}

// Adds `minutes` to a 'YYYY-MM-DD' + 'HH:mm' pair, carrying into the next
// day if it crosses midnight.
function addMinutes(dateKey: string, time: string, minutes: number): { date: string; time: string } {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const carryDays = Math.floor(totalMinutes / 1440)
  const remainder = totalMinutes % 1440
  const newTime = `${String(Math.floor(remainder / 60)).padStart(2, '0')}:${String(remainder % 60).padStart(2, '0')}`

  if (carryDays === 0) return { date: dateKey, time: newTime }

  const carried = new Date(`${dateKey}T00:00:00Z`)
  carried.setUTCDate(carried.getUTCDate() + carryDays)
  return { date: carried.toISOString().slice(0, 10), time: newTime }
}

function nextDateKey(dateKey: string): string {
  const next = new Date(`${dateKey}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

// Writes a real event via calendar.events (see lib/google/calendar-scope.ts
// for why the connected token needs that scope, not just .readonly). Only
// ever called from app/api/search/act/confirm — Search mode 3 (Act) — after
// the user has explicitly confirmed a draft; never a direct consequence of
// typing.
export async function createGoogleCalendarEvent({
  title,
  date,
  time,
  notes,
  durationMinutes = 60,
}: {
  title: string
  date: string
  time: string | null
  notes: string | null
  durationMinutes?: number
}): Promise<{ id: string }> {
  const accessToken = await getValidGoogleAccessToken()

  const body: Record<string, unknown> = { summary: title }
  if (notes) body.description = notes

  if (time) {
    const end = addMinutes(date, time, durationMinutes)
    body.start = { dateTime: `${date}T${time}:00`, timeZone: 'Europe/London' }
    body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone: 'Europe/London' }
  } else {
    // All-day — Google's end.date is exclusive, so a single-day event ends
    // on the following calendar date.
    body.start = { date }
    body.end = { date: nextDateKey(date) }
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Google Calendar event creation failed (${res.status}): ${detail}`)
  }

  const json = (await res.json()) as { id: string }
  return { id: json.id }
}

// Only ever called from app/api/routines/instances/[id] when the user
// deletes a scheduled routine occurrence. A 404/410 is treated as success
// rather than an error — the user may have already deleted the event by
// hand in Google Calendar's own UI, and the app's own row should still be
// removable in that case.
export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const accessToken = await getValidGoogleAccessToken()

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const detail = await res.text()
    throw new Error(`Google Calendar event deletion failed (${res.status}): ${detail}`)
  }
}
