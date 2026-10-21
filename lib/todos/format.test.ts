import { describe, expect, it } from 'vitest'
import { formatDue } from './format'

const TODAY = '2026-10-09' // a Friday

const due = (due_date: string | null, due_time: string | null = null, completed_at: string | null = null) =>
  formatDue({ due_date, due_time, completed_at }, TODAY)

describe('formatDue', () => {
  it('is null without a date', () => {
    expect(due(null)).toBeNull()
  })
  it('names nearby days and always shows the time', () => {
    expect(due('2026-10-09', '14:30')).toEqual({ label: 'Today · 14:30', overdue: false })
    expect(due('2026-10-10')?.label).toBe('Tomorrow')
    expect(due('2026-10-13', '09:00')?.label).toBe('Tue · 09:00')
  })
  it('spells out dates further away, with the year only when it differs', () => {
    expect(due('2026-10-20')?.label).toBe('Tue 20 Oct')
    expect(due('2027-01-04')?.label).toBe('Mon 4 Jan 2027')
  })
  it('flags open past todos as overdue, but not finished ones', () => {
    expect(due('2026-10-08', '17:00')).toEqual({ label: 'Overdue · Yesterday · 17:00', overdue: true })
    expect(due('2026-10-01', null, '2026-10-02T00:00:00Z')).toEqual({ label: 'Thu 1 Oct', overdue: false })
  })
})
