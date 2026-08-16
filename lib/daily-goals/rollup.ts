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
      const completedToday = habitCompletions.some((c) => c.completed_on === todayDateKey)

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
        // following day.
        const target = habit.weekly_target ?? 0
        const completionsBeforeToday = habitCompletions.filter(
          (c) => c.completed_on !== todayDateKey
        ).length
        scheduledToday = target <= 0 || completionsBeforeToday < target
      }

      return {
        habit,
        scheduledToday,
        completedToday,
        isExtraCompletion: completedToday && !scheduledToday,
      }
    })
}

export interface DailyGoalsRollupInput {
  todosDueToday: { completed_at: string | null }[]
  educationTasksDueToday: { completed_at: string | null }[]
  habitSchedule: HabitScheduleResult[]
}

export interface DailyGoalsRollup {
  completed: number
  total: number
  // Habits completed today outside their schedule (see
  // isExtraCompletion above) — not part of completed/total, surfaced
  // separately so the UI can show a "+N" hint without touching the ring.
  extraCompletions: number
}

// The single source of truth for "today's overall completion". Takes
// the three domains' already-fetched-for-today data and returns a plain
// { completed, total } (plus extraCompletions for the UI hint) — no
// Supabase, no React, so this can be tested with plain fixtures.
export function computeDailyGoalsRollup(input: DailyGoalsRollupInput): DailyGoalsRollup {
  const scheduledHabits = input.habitSchedule.filter((h) => h.scheduledToday)
  const extraCompletions = input.habitSchedule.filter((h) => h.isExtraCompletion).length

  const total = input.todosDueToday.length + input.educationTasksDueToday.length + scheduledHabits.length
  const completed =
    input.todosDueToday.filter((t) => t.completed_at !== null).length +
    input.educationTasksDueToday.filter((t) => t.completed_at !== null).length +
    scheduledHabits.filter((h) => h.completedToday).length

  return { completed, total, extraCompletions }
}
