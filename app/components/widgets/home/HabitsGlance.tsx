'use client'

import { useEffect, useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'
import { londonDayBoundsUTC, londonWeekBoundsUTC } from '@/lib/google/london-day'
import { computeHabitSchedule } from '@/lib/habits/schedule'
import { ProgressRing } from '@/components/ui/progress-ring'
import HomeSectionCard from './HomeSectionCard'

export default function HabitsGlance() {
  const { todayDateKey, weekStartKey, weekEndKeyExclusive } = useMemo(() => {
    const day = londonDayBoundsUTC()
    const week = londonWeekBoundsUTC()
    return {
      todayDateKey: day.startDateKey,
      weekStartKey: week.startDateKey,
      weekEndKeyExclusive: week.endDateKey,
    }
  }, [])

  const [habits, setHabits] = useState<DailyGoalHabit[]>([])
  const [completions, setCompletions] = useState<DailyGoalHabitCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      supabase.from('daily_goal_habits').select('*').eq('widget', 'habits').eq('is_active', true),
      // The full week, not just today — times_per_week habits need
      // completions from earlier in the week to know whether they're
      // still scheduled today (see computeHabitSchedule).
      supabase
        .from('daily_goal_habit_completions')
        .select('*')
        .gte('completed_on', weekStartKey)
        .lt('completed_on', weekEndKeyExclusive),
    ]).then(([habitsRes, completionsRes]) => {
      if (cancelled) return
      if (habitsRes.error || completionsRes.error) {
        setError(true)
        setLoading(false)
        return
      }
      setError(false)
      setHabits((habitsRes.data ?? []) as DailyGoalHabit[])
      setCompletions((completionsRes.data ?? []) as DailyGoalHabitCompletion[])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [weekStartKey, weekEndKeyExclusive])

  const schedule = useMemo(
    () => computeHabitSchedule(habits, completions, todayDateKey),
    [habits, completions, todayDateKey]
  )
  const scheduledToday = schedule.filter((s) => s.scheduledToday)
  const doneCount = scheduledToday.filter((s) => s.completedToday).length
  const totalCount = scheduledToday.length
  const ringPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <HomeSectionCard href="/habits" title="Habits" icon={<ListChecks className="h-4 w-4" />} accent="purple">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-xs text-on-surface-variant">Couldn&apos;t load habits.</p>
      ) : habits.length === 0 ? (
        <p>No habits yet.</p>
      ) : (
        <div className="flex flex-col items-center gap-2 py-1">
          <div className={totalCount === 0 ? 'opacity-60' : undefined}>
            <ProgressRing accent="purple" value={ringPercent} size="md" showValue={false} />
          </div>
          <span className="font-display text-sm font-semibold text-on-surface">
            {totalCount === 0 ? 'Nothing scheduled today' : `${doneCount}/${totalCount} today`}
          </span>
        </div>
      )}
    </HomeSectionCard>
  )
}
