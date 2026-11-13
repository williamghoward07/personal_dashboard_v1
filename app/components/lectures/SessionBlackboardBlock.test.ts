import { describe, expect, it, vi } from 'vitest'
import type { MatchedItem, SessionMatch } from '@/lib/blackboard/match'
import type { BbKeyDate } from '@/lib/blackboard/types'
import { matchCount } from './SessionBlackboardBlock'

// The component's imports reach the Supabase client, which needs env to build.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const items = (n: number) => Array.from({ length: n }, () => ({}) as MatchedItem)

const match = (over: Partial<SessionMatch>): SessionMatch => ({
  slides: [],
  readings: [],
  recordings: [],
  other: [],
  keyDates: [],
  moduleReadingList: null,
  uniWeek: 1,
  weekOffset: 0,
  ...over,
})

describe('matchCount', () => {
  it('is 0 with no match', () => {
    expect(matchCount(null)).toBe(0)
    expect(matchCount(match({}))).toBe(0)
  })

  it('adds every group and the key dates', () => {
    expect(
      matchCount(match({ slides: items(1), readings: items(2), recordings: items(1), other: items(3), keyDates: [{}, {}] as BbKeyDate[] }))
    ).toBe(9)
  })

  it('does not count the module reading list', () => {
    expect(matchCount(match({ moduleReadingList: { href: 'https://x', label: 'List' } }))).toBe(0)
  })
})
