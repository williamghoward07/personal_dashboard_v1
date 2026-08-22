import type { MinuteInterval } from './types'

const MINUTES_PER_DAY = 1440

export function parseHHmm(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function formatHHmm(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(wrapped / 60)
  const mins = wrapped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// Resolves a wake time / bedtime pair into the blockable window. If bedtime
// is at or before wake time (e.g. wake 07:00, bedtime 00:30), it's treated
// as occurring after midnight the same night — the next calendar day — by
// adding a full day's worth of minutes rather than rejecting the input.
export function resolveWindow(wakeHHmm: string, bedtimeHHmm: string): MinuteInterval {
  const startMinutes = parseHHmm(wakeHHmm)
  let endMinutes = parseHHmm(bedtimeHHmm)
  if (endMinutes <= startMinutes) endMinutes += MINUTES_PER_DAY
  return { startMinutes, endMinutes }
}

// Splits a possibly-rolled-over minute value (>= 1440) into which day it
// falls on (0 = today, 1 = tomorrow) and the HH:mm within that day, so a
// placed block can be turned back into a real calendar date + time.
export function splitDayOffset(minutes: number): { dayOffset: number; time: string } {
  const dayOffset = Math.floor(minutes / MINUTES_PER_DAY)
  return { dayOffset, time: formatHHmm(minutes) }
}
