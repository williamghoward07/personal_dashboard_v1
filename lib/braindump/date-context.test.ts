import { describe, expect, it } from 'vitest'
import { buildDateContext, shortDayLabel } from './date-context'

describe('buildDateContext', () => {
  it('uses the London day when UTC is still the previous day (BST)', () => {
    const out = buildDateContext(new Date('2026-07-14T23:30:00Z'))
    expect(out).toContain('Today: Wednesday 15 July 2026 (2026-07-15), 00:30 Europe/London time.')
    expect(out).toContain('- today, Wed 15 Jul = 2026-07-15')
    expect(out).toContain('- tomorrow, Thu 16 Jul = 2026-07-16')
  })

  it('handles a GMT instant', () => {
    const out = buildDateContext(new Date('2026-11-16T14:32:00Z'))
    expect(out).toContain('Today: Monday 16 November 2026 (2026-11-16), 14:32 Europe/London time.')
    expect(out).toContain('- Wed 18 Nov = 2026-11-18')
  })

  it('lists 14 days', () => {
    const rows = buildDateContext(new Date('2026-11-16T12:00:00Z')).split('\n').filter((l) => l.startsWith('- '))
    expect(rows).toHaveLength(14)
    expect(rows[13]).toBe('- Sun 29 Nov = 2026-11-29')
  })

  it('rolls over month and year', () => {
    const out = buildDateContext(new Date('2026-12-28T12:00:00Z'))
    expect(out).toContain('- Thu 31 Dec = 2026-12-31')
    expect(out).toContain('- Fri 1 Jan = 2027-01-01')
    expect(out).toContain('- Sun 10 Jan = 2027-01-10')
  })

  it('weekday labels match the ISO dates', () => {
    const rows = buildDateContext(new Date('2026-02-20T12:00:00Z')).split('\n').filter((l) => l.startsWith('- '))
    for (const row of rows) {
      const iso = row.match(/= (\d{4}-\d{2}-\d{2})$/)![1]
      const weekday = new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
      expect(row).toContain(`${weekday} `)
    }
    expect(rows.some((r) => r.includes('Sat 28 Feb = 2026-02-28'))).toBe(true)
    expect(rows.some((r) => r.includes('Sun 1 Mar = 2026-03-01'))).toBe(true)
  })
})

describe('shortDayLabel', () => {
  it('formats a calendar day', () => {
    expect(shortDayLabel('2026-11-20')).toBe('Fri 20 Nov')
  })
})
