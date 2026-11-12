import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// A stand-in for the ai_usage count query: records the filters applied and
// answers with the count of matching fake rows.
const rows: { day: string; feature: string }[] = []
const calls: string[] = []

function builder() {
  let filtered = [...rows]
  const b = {
    select: () => b,
    eq: (col: 'day', value: string) => {
      filtered = filtered.filter((r) => r[col] === value)
      return b
    },
    like: (_col: string, pattern: string) => {
      calls.push(`like ${pattern}`)
      filtered = filtered.filter((r) => r.feature.startsWith('bb'))
      return b
    },
    not: (_col: string, op: string, pattern: string) => {
      calls.push(`not ${op} ${pattern}`)
      filtered = filtered.filter((r) => !r.feature.startsWith('bb'))
      return b
    },
    then: (resolve: (v: { count: number; error: null }) => void) => resolve({ count: filtered.length, error: null }),
  }
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => builder() }),
}))

const { assertUnderDailyBudget, callsToday, remainingCallsToday } = await import('./usage')
const { londonDayBoundsUTC } = await import('@/lib/google/london-day')
const { BB_DAILY_CALL_CAP, DAILY_CALL_CAP, budgetFor, isBlackboardFeature } = await import('./constants')

function fill(feature: string, n: number) {
  const day = londonDayBoundsUTC().startDateKey
  for (let i = 0; i < n; i++) rows.push({ day, feature })
}

describe('budgetFor', () => {
  it('puts bb_* features on the Blackboard budget and everything else on the shared one', () => {
    expect(budgetFor('bb_classify')).toEqual({ scope: 'bb', cap: BB_DAILY_CALL_CAP })
    expect(budgetFor('bb_eval').scope).toBe('bb')
    expect(budgetFor('search')).toEqual({ scope: 'shared', cap: DAILY_CALL_CAP })
    expect(budgetFor('brain_dump').scope).toBe('shared')
    expect(isBlackboardFeature('bb_extract_document')).toBe(true)
    expect(isBlackboardFeature('search_answer')).toBe(false)
    expect(BB_DAILY_CALL_CAP).toBe(80)
    expect(DAILY_CALL_CAP).toBe(200)
  })
})

describe('daily budgets', () => {
  it('counts only the budget a feature belongs to', async () => {
    rows.length = 0
    fill('search', 150)
    fill('bb_classify', 79)
    rows.push({ day: '2000-01-01', feature: 'bb_classify' })

    expect(await callsToday('bb_extract_content')).toBe(79)
    expect(await callsToday('search')).toBe(150)
    expect(calls).toContain('like bb_%')
    expect(calls).toContain('not like bb_%')
    expect(await remainingCallsToday('bb_classify')).toBe(1)
  })

  it('stops bb_* calls at 80 without touching the shared budget, and vice versa', async () => {
    rows.length = 0
    fill('bb_classify', 80)
    await expect(assertUnderDailyBudget('bb_classify')).rejects.toThrow('AI budget reached')
    await expect(assertUnderDailyBudget('search')).resolves.toBeUndefined()

    rows.length = 0
    fill('search', 200)
    await expect(assertUnderDailyBudget('search')).rejects.toThrow('AI budget reached')
    await expect(assertUnderDailyBudget('bb_extract_announcement')).resolves.toBeUndefined()
  })
})
