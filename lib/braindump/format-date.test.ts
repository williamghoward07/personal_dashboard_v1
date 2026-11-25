import { describe, expect, it } from 'vitest'
import { formatDraftDate } from './format-date'

describe('formatDraftDate', () => {
  it('shows weekday without the year in the current year', () => {
    expect(formatDraftDate('2026-11-20', 2026)).toBe('Fri 20 Nov')
  })
  it('adds the year when it differs', () => {
    expect(formatDraftDate('2027-01-01', 2026)).toBe('Fri 1 Jan 2027')
  })
  it('returns the raw string when unparseable', () => {
    expect(formatDraftDate('soon', 2026)).toBe('soon')
    expect(formatDraftDate('2026-02-30', 2026)).toBe('2026-02-30')
  })
})
