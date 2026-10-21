import 'server-only'
import { parseIcs } from './ics'
import type { TimetableSession } from './session'

// Reads the MyTimetable ICS feed (TIMETABLE_ICS_URL — a private link, so a
// server-only env var). Cached in memory for an hour per server instance:
// fresh enough for a moved or cancelled lecture, and cheap. A failed
// refresh serves the last good copy rather than blanking the timetable.

const TTL_MS = 60 * 60 * 1000

export class TimetableNotConfiguredError extends Error {
  constructor() {
    super('TIMETABLE_ICS_URL is not set')
  }
}

let cache: { url: string; at: number; sessions: TimetableSession[] } | null = null

export async function fetchTimetable(): Promise<TimetableSession[]> {
  const raw = process.env.TIMETABLE_ICS_URL?.trim()
  if (!raw) throw new TimetableNotConfiguredError()
  // Calendar apps hand these out as webcal://; it's plain HTTPS underneath.
  const url = raw.replace(/^webcals?:\/\//i, 'https://')

  if (cache && cache.url === url && Date.now() - cache.at < TTL_MS) return cache.sessions

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Timetable feed error: ${res.status}`)
    const sessions = parseIcs(await res.text())
    cache = { url, at: Date.now(), sessions }
    return sessions
  } catch (err) {
    if (cache && cache.url === url) {
      console.error('[timetable] refresh failed, serving cached copy:', err)
      return cache.sessions
    }
    throw err
  }
}
