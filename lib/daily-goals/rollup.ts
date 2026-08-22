import { computeHabitSchedule, type HabitScheduleResult } from '@/lib/habits/schedule'

// Re-exported so existing imports of computeHabitSchedule from this
// module (e.g. DailyGoals.tsx) keep working unchanged — the underlying
// scheduling logic now lives in lib/habits/schedule.ts since Habits and
// Health need it too, not just the Daily Goals roll-up.
export { computeHabitSchedule }
export type { HabitScheduleResult }

export interface DailyGoalsRollupInput {
  todosDueToday: { completed_at: string | null }[]
  educationTasksDueToday: { completed_at: string | null }[]
  followUpsDueToday: { completed_at: string | null }[]
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

  const total =
    input.todosDueToday.length +
    input.educationTasksDueToday.length +
    input.followUpsDueToday.length +
    scheduledHabits.length
  const completed =
    input.todosDueToday.filter((t) => t.completed_at !== null).length +
    input.educationTasksDueToday.filter((t) => t.completed_at !== null).length +
    input.followUpsDueToday.filter((f) => f.completed_at !== null).length +
    scheduledHabits.filter((h) => h.completedToday).length

  return { completed, total, extraCompletions }
}
