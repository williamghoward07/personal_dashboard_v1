import type { DailyGoalHabit, DailyGoalHabitCompletion, HabitStep, HabitStepCheck } from '@/lib/types'
import { londonDateKey } from '@/lib/google/london-day'
import { isCompletionMet, isoWeekday } from './schedule'

// Pure logic for habit steps (the morning routine): which steps are core,
// whether a day is done, and how the week is going. Date keys are
// Europe/London calendar days ('YYYY-MM-DD'); nothing here reads the clock
// except isPastCutoff, which takes `now` as an argument.

export const SUGGESTED_CORE_STEPS = ['Drink a glass of water', 'Make your bed', "Look at today's plan"]
export const SUGGESTED_BONUS_STEPS = ['Stretch for 5 minutes', 'Read a Bible passage', 'Step outside for 5 minutes']
export const DEFAULT_ROUTINE_TARGET = 4
export const MORNING_CUTOFF_HOUR = 11

/** 'YYYY-MM-DD' plus `days` (may be negative). Timezone-free date arithmetic. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function byOrder(a: HabitStep, b: HabitStep): number {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
}

/** Core and bonus steps, in order. With nothing flagged core, every step is core. */
export function splitSteps(steps: HabitStep[]): { core: HabitStep[]; bonus: HabitStep[] } {
  const sorted = steps.slice().sort(byOrder)
  if (!sorted.some((s) => s.is_core)) return { core: sorted, bonus: [] }
  return { core: sorted.filter((s) => s.is_core), bonus: sorted.filter((s) => !s.is_core) }
}

export function checkedStepIds(checks: HabitStepCheck[], dateKey: string): Set<string> {
  return new Set(checks.filter((c) => c.checked_on === dateKey).map((c) => c.step_id))
}

/** Every core step ticked on `dateKey` (mirrors the RPC's rule). */
export function dayComplete(steps: HabitStep[], checks: HabitStepCheck[], dateKey: string): boolean {
  const { core } = splitSteps(steps)
  if (core.length === 0) return false
  const checked = checkedStepIds(checks, dateKey)
  return core.every((s) => checked.has(s.id))
}

function scheduledOn(habit: DailyGoalHabit, dateKey: string): boolean {
  if (habit.frequency_type === 'specific_days') return (habit.days_of_week ?? []).includes(isoWeekday(dateKey))
  return true
}

function metOn(habit: DailyGoalHabit, completions: DailyGoalHabitCompletion[], dateKey: string): boolean {
  return isCompletionMet(
    habit,
    completions.find((c) => c.habit_id === habit.id && c.completed_on === dateKey)
  )
}

export type RoutineWeekState = 'met' | 'on_track' | 'every_day_counts' | 'behind'

export interface RoutineWeekStatus {
  done: number
  target: number
  remaining: number
  /** Scheduled days still available this week (today counts unless already done). */
  daysLeft: number
  state: RoutineWeekState
}

/** How this week (Mon–Sun, starting `weekStartKey`) is going for a habit. */
export function routineWeekStatus(
  habit: DailyGoalHabit,
  completions: DailyGoalHabitCompletion[],
  todayKey: string,
  weekStartKey: string
): RoutineWeekStatus {
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStartKey, i))
  const target =
    habit.frequency_type === 'times_per_week'
      ? (habit.weekly_target ?? 0)
      : weekDays.filter((d) => scheduledOn(habit, d)).length

  const done = weekDays.filter((d) => d <= todayKey && metOn(habit, completions, d)).length
  const remaining = Math.max(0, target - done)
  const doneToday = metOn(habit, completions, todayKey)
  const daysLeft = weekDays.filter(
    (d) => (d > todayKey || (d === todayKey && !doneToday)) && scheduledOn(habit, d)
  ).length

  let state: RoutineWeekState
  if (remaining === 0) state = 'met'
  else if (remaining > daysLeft) state = 'behind'
  else if (remaining === daysLeft) state = 'every_day_counts'
  else state = 'on_track'

  return { done: Math.min(done, target), target, remaining, daysLeft, state }
}

/**
 * "Don't miss twice": the last two scheduled days before today were both
 * missed (and neither predates the habit). One missed day never triggers
 * it, so a planned rest day on a 4-a-week routine stays guilt-free.
 */
export function missedLastTwo(
  habit: DailyGoalHabit,
  completions: DailyGoalHabitCompletion[],
  todayKey: string
): boolean {
  const createdKey = londonDateKey(habit.created_at)
  const previous: string[] = []
  for (let back = 1; back <= 14 && previous.length < 2; back++) {
    const day = shiftDateKey(todayKey, -back)
    if (day < createdKey) break
    if (scheduledOn(habit, day)) previous.push(day)
  }
  return previous.length === 2 && previous.every((d) => !metOn(habit, completions, d))
}

/** Whether it's past `hour`:00 in London at `now`. */
export function isPastCutoff(now: Date, hour = MORNING_CUTOFF_HOUR): boolean {
  const londonHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' }).format(now)
  )
  return londonHour >= hour
}

export function weekStatusLabel(status: RoutineWeekStatus): string {
  switch (status.state) {
    case 'met':
      return 'Week done — anything more is a bonus.'
    case 'on_track':
      return `On track — ${status.remaining} more this week, ${status.daysLeft} days to do it.`
    case 'every_day_counts':
      return `${status.remaining} more needed, ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left — every day counts.`
    case 'behind':
      return "Target's out of reach this week — get as close as you can."
  }
}
