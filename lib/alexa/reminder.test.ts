import { describe, expect, it } from 'vitest'
import {
  describeReminder,
  localDateTimePlus,
  londonNow,
  parseReminder,
  reminderToEventBody,
  reminderToTaskBody,
} from './reminder'

// 12:00 UTC on 21 Sep 2026 = 13:00 in London (BST).
const NOW = new Date('2026-09-21T12:00:00Z')

describe('londonNow', () => {
  it('reads the London wall clock, not UTC', () => {
    expect(londonNow(NOW)).toEqual({ date: '2026-09-21', time: '13:00' })
    expect(londonNow(new Date('2026-09-21T23:30:00Z'))).toEqual({ date: '2026-09-22', time: '00:30' })
  })
})

describe('parseReminder', () => {
  it('accepts a full date, time and task', () => {
    expect(parseReminder({ date: '2026-09-22', time: '15:00', task: 'do the washing up' }, NOW)).toEqual({
      ok: true,
      reminder: { title: 'Do the washing up', date: '2026-09-22', time: '15:00' },
    })
  })

  it.each([
    ['missing task', { date: '2026-09-22', time: '15:00', task: '  ' }],
    ['week-only date', { date: '2026-W39', time: '15:00', task: 'x' }],
    ['impossible date', { date: '2026-02-30', time: '15:00', task: 'x' }],
    ['no date', { time: '15:00', task: 'x' }],
    ['vague time (morning)', { date: '2026-09-22', time: 'MO', task: 'x' }],
    ['no time', { date: '2026-09-22', task: 'x' }],
  ])('refuses %s instead of guessing', (_label, slots) => {
    expect(parseReminder(slots, NOW).ok).toBe(false)
  })

  it('refuses a time already passed today, but allows later today', () => {
    expect(parseReminder({ date: '2026-09-21', time: '12:59', task: 'x' }, NOW).ok).toBe(false)
    expect(parseReminder({ date: '2026-09-21', time: '13:01', task: 'x' }, NOW).ok).toBe(true)
    expect(parseReminder({ date: '2026-09-20', time: '15:00', task: 'x' }, NOW).ok).toBe(false)
  })
})

describe('describeReminder', () => {
  const at = (date: string, time: string) => ({ title: 'Do the washing up', date, time })

  it('says today / tomorrow / a named day', () => {
    expect(describeReminder(at('2026-09-21', '15:00'), NOW)).toBe('Do the washing up, today at 3pm')
    expect(describeReminder(at('2026-09-22', '15:30'), NOW)).toBe('Do the washing up, tomorrow at 3:30pm')
    expect(describeReminder(at('2026-09-25', '09:00'), NOW)).toBe('Do the washing up, on Friday 25 September at 9am')
  })

  it('handles midnight and noon', () => {
    expect(describeReminder(at('2026-09-22', '00:00'), NOW)).toContain('12am')
    expect(describeReminder(at('2026-09-22', '12:00'), NOW)).toContain('12pm')
  })
})

describe('Graph bodies', () => {
  const reminder = { title: 'Do the washing up', date: '2026-09-22', time: '15:00' }

  it('makes a To Do task with a due date and a reminder that alerts', () => {
    expect(reminderToTaskBody(reminder)).toEqual({
      title: 'Do the washing up',
      dueDateTime: { dateTime: '2026-09-22T00:00:00', timeZone: 'Europe/London' },
      reminderDateTime: { dateTime: '2026-09-22T15:00:00', timeZone: 'Europe/London' },
      isReminderOn: true,
    })
  })

  it('makes a 30-minute Outlook event at the same London time', () => {
    const body = reminderToEventBody(reminder)
    expect(body.start).toEqual({ dateTime: '2026-09-22T15:00:00', timeZone: 'Europe/London' })
    expect(body.end).toEqual({ dateTime: '2026-09-22T15:30:00', timeZone: 'Europe/London' })
    expect(body.isReminderOn).toBe(true)
  })

  it('rolls the event end over midnight', () => {
    expect(localDateTimePlus({ ...reminder, time: '23:45' }, 30)).toBe('2026-09-23T00:15:00')
  })
})
