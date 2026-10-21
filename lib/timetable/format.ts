import type { Accent } from '@/lib/theme'
import type { PrepStatus, TimetableSession } from './session'

// Display helpers for sessions, always in Europe/London.

const TZ = 'Europe/London'

/** Traffic light → shared accent (DESIGN.md palette, not raw colours). */
export const PREP_ACCENT: Record<PrepStatus, Accent> = {
  red: 'crimson',
  amber: 'amber',
  green: 'mint',
}

export function formatSessionTime(session: Pick<TimetableSession, 'start' | 'end'>): string {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  return session.end ? `${time(session.start)}–${time(session.end)}` : time(session.start)
}

/** "Mon 19 Oct" */
export function formatSessionDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Mon 19 Oct · 16:00–17:00 · W103" */
export function sessionMeta(session: Pick<TimetableSession, 'start' | 'end' | 'location'>): string {
  return [formatSessionDay(session.start), formatSessionTime(session), session.location].filter(Boolean).join(' · ')
}
