import type { DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'

// ISO-8601 weekday: 1 = Monday ... 7 = Sunday. `dateKey` must already be
// the correct calendar day in whatever timezone matters (this app uses
// Europe/London — see lib/google/london-day.ts) — this function is
// timezone-free on purpose. Once you have a 'YYYY-MM-DD' calendar date,
// its weekday doesn't depend on timezone anymore, only on the date
// itself, so there is no DST edge case to handle here.
export function isoWeekday(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay
}

// A completion row "counts" differently depending on the habit: for a
// plain habit, the row existing at all means it was done. For a
// quantifiable habit, the row might be a below-target partial log (kept
// so the heatmap can show "partial" and so a same-day value persists
// across edits), so only a value that reaches the target counts as met.
export function isCompletionMet(
  habit: DailyGoalHabit,
  completion: DailyGoalHabitCompletion | undefined
): boolean {
  if (!completion) return false
  if (habit.is_quantifiable && habit.target_value != null) {
    return completion.value != null && completion.value >= habit.target_value
  }
  return true
}

export interface HabitScheduleResult {
  habit: DailyGoalHabit
  scheduledToday: boolean
  completedToday: boolean
  // Completed today, but the habit wasn't scheduled today (already met
  // its weekly target, or an off-schedule day for specific_days). Never
  // counted toward the roll-up ring's numerator or denominator — surface
  // it as a subtle "+1" instead of letting it distort progress.
  isExtraCompletion: boolean
}

// Pure: which of the given (already-filtered-to-active) habits are
// scheduled for `todayDateKey`, and whether each was completed today.
export function computeHabitSchedule(
  habits: DailyGoalHabit[],
  completions: DailyGoalHabitCompletion[],
  todayDateKey: string
): HabitScheduleResult[] {
  const weekday = isoWeekday(todayDateKey)

  return habits
    .filter((habit) => habit.is_active)
    .map((habit) => {
      const habitCompletions = completions.filter((c) => c.habit_id === habit.id)
      const todayCompletion = habitCompletions.find((c) => c.completed_on === todayDateKey)
      const completedToday = isCompletionMet(habit, todayCompletion)

      let scheduledToday: boolean
      if (habit.frequency_type === 'daily') {
        scheduledToday = true
      } else if (habit.frequency_type === 'specific_days') {
        scheduledToday = (habit.days_of_week ?? []).includes(weekday)
      } else {
        // times_per_week: scheduled while completions logged *before*
        // today haven't yet reached the target. Excluding today's own
        // completion from this check keeps the habit scheduled on the
        // day it actually meets target (today's tick still counts
        // normally), and only drops it from the schedule starting the
        // following day. Only completions that actually met the habit
        // (not partial quantifiable logs) count toward the target.
        const target = habit.weekly_target ?? 0
        const metBeforeToday = habitCompletions.filter(
          (c) => c.completed_on !== todayDateKey && isCompletionMet(habit, c)
        ).length
        scheduledToday = target <= 0 || metBeforeToday < target
      }

      return {
        habit,
        scheduledToday,
        completedToday,
        isExtraCompletion: completedToday && !scheduledToday,
      }
    })
}

export interface WeeklyProgress {
  completed: number
  target: number
}

// Weekly ring-percentage math for times_per_week / specific_days habits
// (e.g. Health's Running/Gym rings — "done 2 of 3 this week"). Counts MET
// completions within [weekStartKey, weekEndKeyExclusive). Not meaningful
// for frequency_type='daily' habits, which are better represented by a
// single today ring (see computeHabitSchedule/DailyGoals) — returns
// {completed: 0, target: 0} for those rather than throwing, since a
// wrong-shape input here isn't truly exceptional.
export function computeWeeklyProgress(
  habit: DailyGoalHabit,
  completions: DailyGoalHabitCompletion[],
  weekStartKey: string,
  weekEndKeyExclusive: string
): WeeklyProgress {
  if (habit.frequency_type === 'daily') return { completed: 0, target: 0 }

  const target =
    habit.frequency_type === 'times_per_week'
      ? (habit.weekly_target ?? 0)
      : (habit.days_of_week ?? []).length

  const completed = completions.filter(
    (c) =>
      c.habit_id === habit.id &&
      c.completed_on >= weekStartKey &&
      c.completed_on < weekEndKeyExclusive &&
      isCompletionMet(habit, c)
  ).length

  return { completed: Math.min(completed, target), target }
}
