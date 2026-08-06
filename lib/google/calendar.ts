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
