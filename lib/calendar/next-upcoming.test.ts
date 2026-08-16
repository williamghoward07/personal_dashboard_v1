import { describe, expect, it } from 'vitest'
import { pickNextUpcoming } from './next-upcoming'

describe('pickNextUpcoming', () => {
  it('returns null for an empty candidate list', () => {
    expect(pickNextUpcoming([])).toBeNull()
  })

  it('returns the only candidate when there is just one', () => {
    const only = { sortKey: '2026-08-21' }
    expect(pickNextUpcoming([only])).toBe(only)
  })

  it('picks the chronologically earliest candidate across sources', () => {
    const later = { sortKey: '2026-09-01', id: 'later' }
    const soonest = { sortKey: '2026-08-21', id: 'soonest' }
    const middle = { sortKey: '2026-08-25', id: 'middle' }
    expect(pickNextUpcoming([later, soonest, middle])).toBe(soonest)
  })

  it('sorts a date-only item before a timed item on the same day', () => {
    const timed = { sortKey: '2026-08-21T09:00:00.000Z', id: 'timed' }
    const dateOnly = { sortKey: '2026-08-21', id: 'date-only' }
    expect(pickNextUpcoming([timed, dateOnly])).toBe(dateOnly)
  })

  it('does not mutate the input array', () => {
    const candidates = [{ sortKey: '2026-09-01' }, { sortKey: '2026-08-21' }]
    const original = [...candidates]
    pickNextUpcoming(candidates)
    expect(candidates).toEqual(original)
  })

  it('preserves extra fields on the winning candidate', () => {
    const withTask = { sortKey: '2026-08-21', kind: 'task' as const, task: { id: 't1' } }
    expect(pickNextUpcoming([withTask])).toEqual(withTask)
  })
})
