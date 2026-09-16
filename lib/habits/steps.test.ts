import { describe, expect, it } from 'vitest'
import type { DailyGoalHabit, DailyGoalHabitCompletion, HabitStep, HabitStepCheck } from '@/lib/types'
import {
  dayComplete,
  isPastCutoff,
  missedLastTwo,
  routineWeekStatus,
  shiftDateKey,
  splitSteps,
  weekStatusLabel,
} from './steps'

// 2026-09-14 is a Monday.
const MON = '2026-09-14'

function habit(overrides: Partial<DailyGoalHabit> = {}): DailyGoalHabit {
  return {
    id: 'h1',
    name: 'Morning routine',
    icon: '🌅',
    description: '',
    frequency_type: 'times_per_week',
    days_of_week: null,
    weekly_target: 4,
    widget: 'habits',
    colour: '#c084fc',
    is_active: true,
    is_quantifiable: false,
    target_value: null,
    unit: null,
    sort_order: 0,
    created_at: '2026-08-01T08:00:00.000Z',
    ...overrides,
  }
}

function step(id: string, is_core: boolean, sort_order: number): HabitStep {
  return { id, habit_id: 'h1', title: id, is_core, sort_order, created_at: '2026-08-01T08:00:00.000Z' }
}

function check(step_id: string, checked_on: string): HabitStepCheck {
  return { id: `${step_id}-${checked_on}`, step_id, habit_id: 'h1', checked_on, created_at: '' }
}

function done(...days: string[]): DailyGoalHabitCompletion[] {
  return days.map((d) => ({ id: d, habit_id: 'h1', completed_on: d, value: null, created_at: '' }))
}

describe('shiftDateKey', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDateKey('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDateKey('2026-03-29', 1)).toBe('2026-03-30') // BST start is irrelevant to date keys
  })
})

describe('splitSteps / dayComplete', () => {
  const steps = [step('bonus', false, 2), step('bed', true, 1), step('water', true, 0)]

  it('orders steps and separates core from bonus', () => {
    const { core, bonus } = splitSteps(steps)
    expect(core.map((s) => s.id)).toEqual(['water', 'bed'])
    expect(bonus.map((s) => s.id)).toEqual(['bonus'])
  })

  it('treats every step as core when none is flagged', () => {
    const { core, bonus } = splitSteps([step('a', false, 0), step('b', false, 1)])
    expect(core.map((s) => s.id)).toEqual(['a', 'b'])
    expect(bonus).toEqual([])
  })

  it('needs every core step ticked on that day, bonus optional', () => {
    expect(dayComplete(steps, [check('water', MON)], MON)).toBe(false)
    expect(dayComplete(steps, [check('water', MON), check('bed', MON)], MON)).toBe(true)
    expect(dayComplete(steps, [check('water', MON), check('bed', '2026-09-13')], MON)).toBe(false)
    expect(dayComplete([], [], MON)).toBe(false)
  })
})

describe('routineWeekStatus', () => {
  it('is on track early in the week', () => {
    const status = routineWeekStatus(habit(), done(MON), '2026-09-15', MON)
    expect(status).toMatchObject({ done: 1, target: 4, remaining: 3, daysLeft: 6, state: 'on_track' })
  })

  it('flags when every remaining day is needed', () => {
    // Friday, nothing done yet: 4 needed, Fri–Sun = 3 days → behind.
    expect(routineWeekStatus(habit(), [], '2026-09-18', MON).state).toBe('behind')
    // Thursday, nothing done: 4 needed, Thu–Sun = 4 days.
    expect(routineWeekStatus(habit(), [], '2026-09-17', MON).state).toBe('every_day_counts')
  })

  it("doesn't count today as available once it's done", () => {
    const status = routineWeekStatus(habit(), done(MON, '2026-09-15', '2026-09-17'), '2026-09-17', MON)
    // Thursday done → Fri, Sat, Sun left.
    expect(status).toMatchObject({ done: 3, remaining: 1, daysLeft: 3, state: 'on_track' })
  })

  it('is met once the target is reached, capping done at the target', () => {
    const status = routineWeekStatus(
      habit({ weekly_target: 2 }),
      done(MON, '2026-09-15', '2026-09-16'),
      '2026-09-16',
      MON
    )
    expect(status).toMatchObject({ done: 2, target: 2, remaining: 0, state: 'met' })
  })

  it('uses scheduled days for specific-day habits', () => {
    const weekdays = habit({ frequency_type: 'specific_days', days_of_week: [1, 3, 5], weekly_target: null })
    const status = routineWeekStatus(weekdays, done(MON), '2026-09-16', MON)
    expect(status).toMatchObject({ done: 1, target: 3, remaining: 2, daysLeft: 2, state: 'every_day_counts' })
  })

  it('has a label for every state', () => {
    for (const today of ['2026-09-15', '2026-09-17', '2026-09-18']) {
      expect(weekStatusLabel(routineWeekStatus(habit(), [], today, MON))).not.toBe('')
    }
    expect(weekStatusLabel(routineWeekStatus(habit({ weekly_target: 1 }), done(MON), MON, MON))).toMatch(/done/i)
  })
})

describe('missedLastTwo', () => {
  const WED = '2026-09-16'

  it('stays quiet after a single missed day', () => {
    expect(missedLastTwo(habit(), done('2026-09-14'), WED)).toBe(false)
  })

  it('nudges after two missed days in a row', () => {
    expect(missedLastTwo(habit(), done('2026-09-13'), WED)).toBe(true)
  })

  it('never nags about days before the habit existed', () => {
    expect(missedLastTwo(habit({ created_at: '2026-09-15T07:00:00.000Z' }), [], WED)).toBe(false)
  })

  it('skips unscheduled days for specific-day habits', () => {
    // Mon/Wed/Fri habit on Wed: previous scheduled days are Mon and Fri 11th.
    const mwf = habit({ frequency_type: 'specific_days', days_of_week: [1, 3, 5], weekly_target: null })
    expect(missedLastTwo(mwf, done('2026-09-14'), WED)).toBe(false)
    expect(missedLastTwo(mwf, done('2026-09-15'), WED)).toBe(true)
  })
})

describe('isPastCutoff', () => {
  it('uses London time', () => {
    // 10:30 UTC in September is 11:30 BST.
    expect(isPastCutoff(new Date('2026-09-16T10:30:00Z'))).toBe(true)
    expect(isPastCutoff(new Date('2026-09-16T09:30:00Z'))).toBe(false)
    // January: London = UTC.
    expect(isPastCutoff(new Date('2026-01-16T10:30:00Z'))).toBe(false)
  })
})
