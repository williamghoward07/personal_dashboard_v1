import { describe, expect, it } from 'vitest'
import {
  dueTimeLabel,
  failedLabel,
  formatAge,
  formatDueDay,
  processingLabel,
  relativeDueLabel,
  syncLabel,
} from './work-format'

describe('relativeDueLabel', () => {
  it('reads today, tomorrow and days ahead', () => {
    expect(relativeDueLabel('2026-11-13', '2026-11-13')).toBe('today')
    expect(relativeDueLabel('2026-11-14', '2026-11-13')).toBe('tomorrow')
    expect(relativeDueLabel('2026-11-16', '2026-11-13')).toBe('in 3 days')
  })
  it('reads overdue days', () => {
    expect(relativeDueLabel('2026-11-12', '2026-11-13')).toBe('1 day overdue')
    expect(relativeDueLabel('2026-11-11', '2026-11-13')).toBe('2 days overdue')
  })
})

describe('formatDueDay / dueTimeLabel', () => {
  it('formats the London day with its weekday', () => {
    expect(formatDueDay('2026-11-13')).toBe('Fri 13 Nov')
  })
  it('shows the London wall-clock time, in winter and summer', () => {
    expect(dueTimeLabel('2026-11-13', '2026-11-13T14:00:00Z')).toBe('14:00')
    expect(dueTimeLabel('2026-07-01', '2026-07-01T13:00:00Z')).toBe('14:00')
  })
  it('drops a time that is on a different London day, and a missing one', () => {
    expect(dueTimeLabel('2026-11-14', '2026-11-13T14:00:00Z')).toBeNull()
    expect(dueTimeLabel('2026-11-13', null)).toBeNull()
    expect(dueTimeLabel(null, '2026-11-13T14:00:00Z')).toBeNull()
  })
  it('keeps a late-evening summer time on the London day, not the UTC one', () => {
    expect(dueTimeLabel('2026-07-02', '2026-07-01T23:30:00Z')).toBe('00:30')
  })
})

describe('formatAge', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  it('steps through minutes, hours and days', () => {
    expect(formatAge('2026-11-13T12:00:00Z', now)).toBe('just now')
    expect(formatAge('2026-11-13T11:15:00Z', now)).toBe('45 min ago')
    expect(formatAge('2026-11-13T10:00:00Z', now)).toBe('2 h ago')
    expect(formatAge('2026-11-12T10:00:00Z', now)).toBe('1 day ago')
    expect(formatAge('2026-11-10T10:00:00Z', now)).toBe('3 days ago')
  })
})

describe('syncLabel', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  it('says fresh, stale, never and failed', () => {
    expect(syncLabel('fresh', '2026-11-13T10:00:00Z', now)).toEqual({ text: 'Synced 2 h ago', tone: 'ok' })
    expect(syncLabel('stale', '2026-11-10T10:00:00Z', now)).toEqual({
      text: 'Last synced 3 days ago. Open Blackboard to sync.',
      tone: 'warn',
    })
    expect(syncLabel('never', null, now).text).toBe('Never synced. Open Blackboard to sync.')
    expect(syncLabel('failed', null, now)).toEqual({ text: 'Last sync failed', tone: 'bad' })
  })
})

describe('processingLabel', () => {
  const totals = { processed: 4, unchanged: 30, added: 2 }
  it('describes a running pass, a finished one and the budget', () => {
    expect(processingLabel({ state: 'running', totals, remaining: 7 })).toBe('Reading new items (7 left)')
    expect(processingLabel({ state: 'done', totals, remaining: 0 })).toBe('4 new items read, 30 unchanged')
    expect(processingLabel({ state: 'done', totals: { ...totals, processed: 1 }, remaining: 0 })).toBe(
      '1 new item read, 30 unchanged'
    )
    expect(processingLabel({ state: 'budget', totals, remaining: 3 })).toBe(
      'AI limit reached for today. It continues tomorrow.'
    )
  })
  it('says nothing when idle, disabled or nothing was read', () => {
    expect(processingLabel({ state: 'idle', totals, remaining: 0 })).toBeNull()
    expect(processingLabel({ state: 'disabled', totals, remaining: 0 })).toBeNull()
    expect(processingLabel({ state: 'done', totals: { ...totals, processed: 0 }, remaining: 0 })).toBeNull()
  })
  it('counts failed rows', () => {
    expect(failedLabel(1)).toBe('1 item could not be read')
    expect(failedLabel(3)).toBe('3 items could not be read')
  })
})
