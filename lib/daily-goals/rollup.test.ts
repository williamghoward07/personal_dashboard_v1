import { describe, expect, it } from 'vitest'
import { computeDailyGoalsRollup, computeHabitSchedule, isoWeekday } from './rollup'
import type { DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'

function habit(overrides: Partial<DailyGoalHabit> = {}): DailyGoalHabit {
  return {
    id: 'habit-1',
    name: 'Test habit',
    frequency_type: 'daily',
    days_of_week: null,
    weekly_target: null,
    widget: 'habits',
    colour: '#849587',
    is_active: true,
    created_at: '2026-08-03T00:00:00.000Z',
    ...overrides,
  }
}

function completion(overrides: Partial<DailyGoalHabitCompletion> = {}): DailyGoalHabitCompletion {
  return {
    id: `completion-${Math.random()}`,
    habit_id: 'habit-1',
    completed_on: '2026-08-03',
    created_at: '2026-08-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('isoWeekday', () => {
  it('returns 1 for Monday and 7 for Sunday', () => {
    // 2026-08-03 is a Monday, 2026-08-09 is the following Sunday.
    expect(isoWeekday('2026-08-03')).toBe(1)
    expect(isoWeekday('2026-08-04')).toBe(2)
    expect(isoWeekday('2026-08-09')).toBe(7)
  })
})

describe('computeHabitSchedule', () => {
  it('schedules a daily habit every day regardless of completions', () => {
    const [result] = computeHabitSchedule([habit({ frequency_type: 'daily' })], [], '2026-08-05')
    expect(result.scheduledToday).toBe(true)
    expect(result.completedToday).toBe(false)
  })

  it('excludes inactive habits entirely', () => {
    const results = computeHabitSchedule([habit({ is_active: false })], [], '2026-08-05')
    expect(results).toHaveLength(0)
  })

  it('schedules a specific_days habit only on its configured weekdays', () => {
    const h = habit({ frequency_type: 'specific_days', days_of_week: [2, 4] }) // Tue, Thu

    const tuesday = computeHabitSchedule([h], [], '2026-08-04')[0] // Tuesday
    const wednesday = computeHabitSchedule([h], [], '2026-08-05')[0] // Wednesday

    expect(tuesday.scheduledToday).toBe(true)
    expect(wednesday.scheduledToday).toBe(false)
  })

  it('a times_per_week habit stays scheduled below target and disappears once met', () => {
    const h = habit({ frequency_type: 'times_per_week', weekly_target: 2 })

    // Nothing logged yet this week: scheduled.
    const day1 = computeHabitSchedule([h], [], '2026-08-03')[0]
    expect(day1.scheduledToday).toBe(true)

    // One completion earlier this week (Monday), still below target(2): scheduled.
    const day2 = computeHabitSchedule(
      [h],
      [completion({ completed_on: '2026-08-03' })],
      '2026-08-04'
    )[0]
    expect(day2.scheduledToday).toBe(true)

    // Two completions earlier this week (Mon, Tue), target(2) met: no longer scheduled.
    const day3 = computeHabitSchedule(
      [h],
      [completion({ completed_on: '2026-08-03' }), completion({ completed_on: '2026-08-04' })],
      '2026-08-05'
    )[0]
    expect(day3.scheduledToday).toBe(false)
  })

  it('the day the target is met, that day itself is still scheduled (today\'s tick counts)', () => {
    const h = habit({ frequency_type: 'times_per_week', weekly_target: 1 })
    // Completing today for the first time this week — nothing before today.
    const today = computeHabitSchedule([h], [completion({ completed_on: '2026-08-03' })], '2026-08-03')[0]
    expect(today.scheduledToday).toBe(true)
    expect(today.completedToday).toBe(true)
    expect(today.isExtraCompletion).toBe(false)
  })

  it('flags a completion logged after the weekly target was already met as extra, not scheduled', () => {
    const h = habit({ frequency_type: 'times_per_week', weekly_target: 1 })
    // Already met target on Monday; logging again on Tuesday.
    const completions = [
      completion({ completed_on: '2026-08-03' }),
      completion({ completed_on: '2026-08-04' }),
    ]
    const tuesday = computeHabitSchedule([h], completions, '2026-08-04')[0]

    expect(tuesday.scheduledToday).toBe(false)
    expect(tuesday.completedToday).toBe(true)
    expect(tuesday.isExtraCompletion).toBe(true)
  })
})

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
