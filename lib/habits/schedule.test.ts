import { describe, expect, it } from 'vitest'
import {
  computeHabitSchedule,
  computeWeeklyProgress,
  isCompletionMet,
  isoWeekday,
} from './schedule'
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

describe('isoWeekday', () => {
  it('returns 1 for Monday and 7 for Sunday', () => {
    // 2026-08-03 is a Monday, 2026-08-09 is the following Sunday.
    expect(isoWeekday('2026-08-03')).toBe(1)
    expect(isoWeekday('2026-08-04')).toBe(2)
    expect(isoWeekday('2026-08-09')).toBe(7)
  })
})

describe('isCompletionMet', () => {
  it('is false when there is no completion row', () => {
    expect(isCompletionMet(habit(), undefined)).toBe(false)
  })

  it('a non-quantifiable habit is met by the row existing at all', () => {
    expect(isCompletionMet(habit({ is_quantifiable: false }), completion())).toBe(true)
  })

  it('a quantifiable habit is only met once value reaches target', () => {
    const h = habit({ is_quantifiable: true, target_value: 20 })
    expect(isCompletionMet(h, completion({ value: 10 }))).toBe(false)
    expect(isCompletionMet(h, completion({ value: 20 }))).toBe(true)
    expect(isCompletionMet(h, completion({ value: 25 }))).toBe(true)
    expect(isCompletionMet(h, completion({ value: null }))).toBe(false)
  })

  it('a quantifiable habit with no target set falls back to row-exists', () => {
    const h = habit({ is_quantifiable: true, target_value: null })
    expect(isCompletionMet(h, completion({ value: 1 }))).toBe(true)
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

  it('a below-target partial log does not count as completed today, for a quantifiable habit', () => {
    const h = habit({ frequency_type: 'daily', is_quantifiable: true, target_value: 20 })
    const partial = computeHabitSchedule(
      [h],
      [completion({ completed_on: '2026-08-05', value: 5 })],
      '2026-08-05'
    )[0]
    expect(partial.completedToday).toBe(false)

    const met = computeHabitSchedule(
      [h],
      [completion({ completed_on: '2026-08-05', value: 20 })],
      '2026-08-05'
    )[0]
    expect(met.completedToday).toBe(true)
  })

  it('a partial (below-target) log does not count toward a times_per_week target', () => {
    const h = habit({
      frequency_type: 'times_per_week',
      weekly_target: 1,
      is_quantifiable: true,
      target_value: 20,
    })
    // Monday: logged, but below target — should not satisfy the weekly target.
    const tuesday = computeHabitSchedule(
      [h],
      [completion({ completed_on: '2026-08-03', value: 5 })],
      '2026-08-04'
    )[0]
    expect(tuesday.scheduledToday).toBe(true)
  })
})

describe('computeWeeklyProgress', () => {
  it('returns zero/zero for daily habits — not a meaningful weekly figure', () => {
    const h = habit({ frequency_type: 'daily' })
    expect(computeWeeklyProgress(h, [], '2026-08-03', '2026-08-10')).toEqual({
      completed: 0,
      target: 0,
    })
  })

  it('counts met completions within the week window for a times_per_week habit', () => {
    const h = habit({ frequency_type: 'times_per_week', weekly_target: 3 })
    const completions = [
      completion({ completed_on: '2026-08-03' }),
      completion({ completed_on: '2026-08-05' }),
      // Outside the week window — should not count.
      completion({ completed_on: '2026-08-11' }),
    ]
    expect(computeWeeklyProgress(h, completions, '2026-08-03', '2026-08-10')).toEqual({
      completed: 2,
      target: 3,
    })
  })

  it('caps completed at target even if more sessions were logged', () => {
    const h = habit({ frequency_type: 'times_per_week', weekly_target: 1 })
    const completions = [
      completion({ completed_on: '2026-08-03' }),
      completion({ completed_on: '2026-08-04' }),
    ]
    expect(computeWeeklyProgress(h, completions, '2026-08-03', '2026-08-10')).toEqual({
      completed: 1,
      target: 1,
    })
  })

  it('uses days_of_week length as the target for a specific_days habit', () => {
    const h = habit({ frequency_type: 'specific_days', days_of_week: [1, 3, 5] })
    const completions = [completion({ completed_on: '2026-08-03' })]
    expect(computeWeeklyProgress(h, completions, '2026-08-03', '2026-08-10')).toEqual({
      completed: 1,
      target: 3,
    })
  })

  it('does not count a partial (below-target) quantifiable log toward weekly progress', () => {
    const h = habit({
      frequency_type: 'times_per_week',
      weekly_target: 2,
      is_quantifiable: true,
      target_value: 10,
    })
    const completions = [
      completion({ completed_on: '2026-08-03', value: 10 }),
      completion({ completed_on: '2026-08-04', value: 3 }),
    ]
    expect(computeWeeklyProgress(h, completions, '2026-08-03', '2026-08-10')).toEqual({
      completed: 1,
      target: 2,
    })
  })
})
