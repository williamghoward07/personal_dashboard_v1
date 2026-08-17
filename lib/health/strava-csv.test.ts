import { describe, it, expect } from 'vitest'
import { parseStravaCsvRows } from './strava-csv'

function row(overrides: Record<string, string>): Record<string, string> {
  return {
    'Activity ID': '1234567890',
    'Activity Date': 'Aug 15, 2026, 6:30:00 AM',
    'Activity Type': 'Run',
    'Elapsed Time': '1800',
    Distance: '5000',
    'Elevation Gain': '42',
    ...overrides,
  }
}

describe('parseStravaCsvRows', () => {
  it('returns an empty result for no rows', () => {
    expect(parseStravaCsvRows([])).toEqual({ candidates: [], skippedRows: 0, totalRows: 0 })
  })

  it('maps a well-formed row: seconds to minutes, meters to km, external id', () => {
    const result = parseStravaCsvRows([row({})])
    expect(result.totalRows).toBe(1)
    expect(result.skippedRows).toBe(0)
    expect(result.candidates).toHaveLength(1)

    const c = result.candidates[0]
    expect(c.activity_type).toBe('Run')
    expect(c.duration_minutes).toBe(30)
    expect(c.distance_km).toBe(5)
    expect(c.elevation_gain_m).toBe(42)
    expect(c.external_id).toBe('1234567890')
    expect(Number.isNaN(new Date(c.occurred_at).getTime())).toBe(false)
  })

  it('skips a row with no date and counts it', () => {
    const result = parseStravaCsvRows([row({ 'Activity Date': '' })])
    expect(result.candidates).toHaveLength(0)
    expect(result.skippedRows).toBe(1)
    expect(result.totalRows).toBe(1)
  })

  it('skips a row with no activity type', () => {
    const result = parseStravaCsvRows([row({ 'Activity Type': '' })])
    expect(result.candidates).toHaveLength(0)
    expect(result.skippedRows).toBe(1)
  })

  it('skips a row whose date string does not parse', () => {
    const result = parseStravaCsvRows([row({ 'Activity Date': 'not a date' })])
    expect(result.candidates).toHaveLength(0)
    expect(result.skippedRows).toBe(1)
  })

  it('leaves distance/duration/elevation/external_id null when those columns are absent', () => {
    const result = parseStravaCsvRows([{ 'Activity Date': 'Aug 15, 2026, 6:30:00 AM', 'Activity Type': 'Run' }])
    expect(result.candidates).toHaveLength(1)
    const c = result.candidates[0]
    expect(c.duration_minutes).toBeNull()
    expect(c.distance_km).toBeNull()
    expect(c.elevation_gain_m).toBeNull()
    expect(c.external_id).toBeNull()
  })

  it('treats a non-numeric or zero distance/duration as absent rather than zero', () => {
    const result = parseStravaCsvRows([row({ Distance: '0', 'Elapsed Time': 'abc' })])
    const c = result.candidates[0]
    expect(c.distance_km).toBeNull()
    expect(c.duration_minutes).toBeNull()
  })

  it('processes multiple rows independently, mixing valid and invalid', () => {
    const result = parseStravaCsvRows([
      row({ 'Activity Type': 'Run' }),
      row({ 'Activity Date': '' }),
      row({ 'Activity Type': 'Ride', 'Activity ID': 'abc999' }),
    ])
    expect(result.totalRows).toBe(3)
    expect(result.skippedRows).toBe(1)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates.map((c) => c.activity_type)).toEqual(['Run', 'Ride'])
  })

  it('falls back to a fuzzy column match when the exact expected header is absent', () => {
    // e.g. a re-saved/edited CSV using "Type" instead of "Activity Type".
    const result = parseStravaCsvRows([{ 'Activity Date': 'Aug 15, 2026, 6:30:00 AM', Type: 'Swim' }])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].activity_type).toBe('Swim')
  })
})
