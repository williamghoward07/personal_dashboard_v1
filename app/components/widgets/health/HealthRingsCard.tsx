'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'
import { londonWeekBoundsUTC } from '@/lib/google/london-day'
import { computeWeeklyProgress } from '@/lib/habits/schedule'
import { ProgressRing } from '@/components/ui/progress-ring'
import WidgetCard from '../../WidgetCard'

// One ring per active widget='health' habit — generic by design (not
// hardcoded to Running/Gym), so a new health habit shows up here with no
// code change. Shares computeWeeklyProgress with Habits (lib/habits/
// schedule.ts) since Health's habits are always times_per_week/
// specific_days, never 'daily' — a single day's ring wouldn't mean
// anything for "3x a week at the gym".
export default function HealthRingsCard() {
  const { weekStartKey, weekEndKeyExclusive } = useMemo(() => {
    const week = londonWeekBoundsUTC()
    return { weekStartKey: week.startDateKey, weekEndKeyExclusive: week.endDateKey }
  }, [])

  const [habits, setHabits] = useState<DailyGoalHabit[]>([])
  const [completions, setCompletions] = useState<DailyGoalHabitCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      supabase.from('daily_goal_habits').select('*').eq('widget', 'health').eq('is_active', true),
      supabase
        .from('daily_goal_habit_completions')
        .select('*')
        .gte('completed_on', weekStartKey)
        .lt('completed_on', weekEndKeyExclusive),
    ]).then(([habitsRes, completionsRes]) => {
      if (cancelled) return
      if (habitsRes.error || completionsRes.error) {
        setError(habitsRes.error?.message ?? completionsRes.error?.message ?? 'Failed to load')
        setLoading(false)
        return
      }
      setError(null)
      setHabits((habitsRes.data ?? []) as DailyGoalHabit[])
      setCompletions((completionsRes.data ?? []) as DailyGoalHabitCompletion[])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [weekStartKey, weekEndKeyExclusive])

  return (
    <WidgetCard title="This week" accent="mint" className="sm:col-span-2 xl:col-span-4">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-xs text-error">{error}</p>
      ) : habits.length === 0 ? (
        <p>No health habits configured yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          {habits.map((habit) => {
            const progress = computeWeeklyProgress(habit, completions, weekStartKey, weekEndKeyExclusive)
            const percent = progress.target > 0 ? Math.round((progress.completed / progress.target) * 100) : 0
            return (
              <div key={habit.id} className="flex flex-col items-center gap-2">
                <ProgressRing
                  accent="mint"
                  value={percent}
                  size="lg"
                  showValue
                  formatValue={() => `${progress.completed}/${progress.target}`}
                />
                <span className="text-sm font-medium text-on-surface">{habit.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </WidgetCard>
  )
}
