import { describe, expect, it } from 'vitest'
import { computeDailyGoalsRollup } from './rollup'
import { computeHabitSchedule } from '@/lib/habits/schedule'
import type { DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'

function habit(overrides: Partial<DailyGoalHabit> = {}): DailyGoalHabit {
  return {
    id: 'habit-1',
    name: 'Test habit',
    icon: '⭐',
    description: '',
    frequency_type: 'daily',
    days_of_week: null,
    weekly_target: null,
    widget: 'habits',
    colour: '#849587',
    is_active: true,
    is_quantifiable: false,
    target_value: null,
    unit: null,
    sort_order: 0,
    created_at: '2026-08-03T00:00:00.000Z',
    ...overrides,
  }
}

function completion(overrides: Partial<DailyGoalHabitCompletion> = {}): DailyGoalHabitCompletion {
  return {
    id: `completion-${Math.random()}`,
    habit_id: 'habit-1',
    completed_on: '2026-08-03',
    value: null,
    created_at: '2026-08-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeDailyGoalsRollup', () => {
  it('returns a zero/zero rest state when nothing is due', () => {
    const rollup = computeDailyGoalsRollup({
      todosDueToday: [],
      educationTasksDueToday: [],
      habitSchedule: [],
    })
    expect(rollup).toEqual({ completed: 0, total: 0, extraCompletions: 0 })
  })

  it('sums completed/total across todos, education tasks and scheduled habits', () => {
    const h = habit({ frequency_type: 'daily' })
    const rollup = computeDailyGoalsRollup({
      todosDueToday: [{ completed_at: '2026-08-05T09:00:00.000Z' }, { completed_at: null }],
      educationTasksDueToday: [{ completed_at: null }],
      habitSchedule: computeHabitSchedule([h], [completion({ habit_id: h.id, completed_on: '2026-08-05' })], '2026-08-05'),
    })
    // 1 todo done + 1 habit done = 2 completed; 2 todos + 1 education task + 1 habit = 4 total.
    expect(rollup).toEqual({ completed: 2, total: 4, extraCompletions: 0 })
  })

  it('an extra-credit completion does not alter the denominator and never pushes past 100%', () => {
    const h = habit({ frequency_type: 'times_per_week', weekly_target: 1 })
    // Target already met Monday; extra completion logged Tuesday.
    const schedule = computeHabitSchedule(
      [h],
      [completion({ habit_id: h.id, completed_on: '2026-08-03' }), completion({ habit_id: h.id, completed_on: '2026-08-04' })],
      '2026-08-04'
    )

    const rollup = computeDailyGoalsRollup({
      todosDueToday: [],
      educationTasksDueToday: [],
      habitSchedule: schedule,
    })

    // The habit isn't scheduled today, so it contributes to neither side.
    expect(rollup.total).toBe(0)
    expect(rollup.completed).toBe(0)
    expect(rollup.extraCompletions).toBe(1)
    expect(rollup.completed).toBeLessThanOrEqual(rollup.total)
  })
})
