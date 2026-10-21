// Pure logic for the private Alexa skill: turn the spoken slots
// (AMAZON.DATE / AMAZON.TIME / AMAZON.SearchQuery) into one reminder, and
// read it back. No network — see app/api/alexa/route.ts for the wiring.

import { APP_TIMEZONE } from '@/lib/microsoft/todo-mapping'

export interface ReminderSlots {
  date?: string | null
  time?: string | null
  task?: string | null
}

export interface Reminder {
  title: string
  /** London calendar day, YYYY-MM-DD. */
  date: string
  /** London wall-clock time, HH:MM (24h). */
  time: string
}

export type ParsedReminder = { ok: true; reminder: Reminder } | { ok: false; speech: string }

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function isRealDate(value: string): boolean {
  const match = value.match(DATE_RE)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}

/** London "now" as a local date + time, for past-time checks and "tomorrow". */
export function londonNow(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/**
 * Validate what Alexa heard. Nothing is guessed: a missing or vague date,
 * time or task (Alexa can return "2026-W39" or "MO" for "morning") is
 * asked for again rather than defaulted, and a time that has already
 * passed today is refused.
 */
export function parseReminder(slots: ReminderSlots, now: Date): ParsedReminder {
  const task = slots.task?.trim()
  if (!task) return { ok: false, speech: 'What should I remind you to do? Try: remind me tomorrow at 3pm to do the washing up.' }

  const date = slots.date?.trim() ?? ''
  if (!isRealDate(date)) {
    return { ok: false, speech: 'I need a specific day, like tomorrow or the 25th of September. Please try again.' }
  }

  const time = slots.time?.trim() ?? ''
  if (!TIME_RE.test(time)) {
    return { ok: false, speech: 'I need a specific time, like 3pm. Please try again.' }
  }

  const today = londonNow(now)
  if (date < today.date || (date === today.date && time <= today.time)) {
    return { ok: false, speech: 'That time has already passed. Please try again.' }
  }

  return { ok: true, reminder: { title: task.charAt(0).toUpperCase() + task.slice(1), date, time } }
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function speakDay(date: string, today: string): string {
  if (date === today) return 'today'
  if (date === addDays(today, 1)) return 'tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  return `on ${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d)))}`
}

function speakTime(time: string): string {
  const [hh, mm] = time.split(':').map(Number)
  const suffix = hh >= 12 ? 'pm' : 'am'
  const hour = hh % 12 === 0 ? 12 : hh % 12
  return mm === 0 ? `${hour}${suffix}` : `${hour}:${String(mm).padStart(2, '0')}${suffix}`
}

/** "Do the washing up, tomorrow at 3pm" — for the spoken confirmation. */
export function describeReminder(reminder: Reminder, now: Date): string {
  return `${reminder.title}, ${speakDay(reminder.date, londonNow(now).date)} at ${speakTime(reminder.time)}`
}

const EVENT_MINUTES = 30

/** The reminder's time plus `minutes`, as a London-local Graph dateTime (no offset). */
export function localDateTimePlus(reminder: Reminder, minutes: number): string {
  const [y, m, d] = reminder.date.split('-').map(Number)
  const [hh, mm] = reminder.time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm + minutes)).toISOString().slice(0, 19)
}

/**
 * A To Do task body. Like changesToGraphPatch, the due date is midnight
 * London; the reminder carries the time (and makes the phone alert), which
 * mapTaskToRow turns back into due_time on the next pull.
 */
export function reminderToTaskBody(reminder: Reminder) {
  return {
    title: reminder.title,
    dueDateTime: { dateTime: `${reminder.date}T00:00:00`, timeZone: APP_TIMEZONE },
    reminderDateTime: { dateTime: `${reminder.date}T${reminder.time}:00`, timeZone: APP_TIMEZONE },
    isReminderOn: true,
  }
}

/** An Outlook event at the reminder time (30 minutes, with a phone alert at the start). */
export function reminderToEventBody(reminder: Reminder) {
  return {
    subject: reminder.title,
    start: { dateTime: localDateTimePlus(reminder, 0), timeZone: APP_TIMEZONE },
    end: { dateTime: localDateTimePlus(reminder, EVENT_MINUTES), timeZone: APP_TIMEZONE },
    isReminderOn: true,
    reminderMinutesBeforeStart: 0,
  }
}
