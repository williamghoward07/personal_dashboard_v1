'use client'

import { useEffect, useMemo, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ActivitySession, DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'
import { londonWeekBoundsUTC } from '@/lib/google/london-day'
import { computeWeeklyProgress } from '@/lib/habits/schedule'
import { ProgressRing } from '@/components/ui/progress-ring'
import HomeSectionCard from './HomeSectionCard'

export default function HealthGlance() {
  const { weekStartKey, weekEndKeyExclusive } = useMemo(() => {
    const week = londonWeekBoundsUTC()
    return { weekStartKey: week.startDateKey, weekEndKeyExclusive: week.endDateKey }
  }, [])

  const [habits, setHabits] = useState<DailyGoalHabit[]>([])
  const [completions, setCompletions] = useState<DailyGoalHabitCompletion[]>([])
  const [lastSession, setLastSession] = useState<ActivitySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      supabase.from('daily_goal_habits').select('*').eq('widget', 'health').eq('is_active', true),
      supabase
        .from('daily_goal_habit_completions')
        .select('*')
        .gte('completed_on', weekStartKey)
        .lt('completed_on', weekEndKeyExclusive),
      supabase.from('activity_sessions').select('*').order('occurred_at', { ascending: false }).limit(1),
    ]).then(([habitsRes, completionsRes, sessionsRes]) => {
      if (cancelled) return
      if (habitsRes.error || completionsRes.error) {
        setError(true)
        setLoading(false)
        return
      }
      setError(false)
      setHabits((habitsRes.data ?? []) as DailyGoalHabit[])
      setCompletions((completionsRes.data ?? []) as DailyGoalHabitCompletion[])
      setLastSession((sessionsRes.data?.[0] ?? null) as ActivitySession | null)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [weekStartKey, weekEndKeyExclusive])

  const rings = useMemo(
    () =>
      habits.map((habit) => ({
        habit,
        progress: computeWeeklyProgress(habit, completions, weekStartKey, weekEndKeyExclusive),
      })),
    [habits, completions, weekStartKey, weekEndKeyExclusive]
  )

  return (
    <HomeSectionCard href="/health" title="Health" icon={<Heart className="h-4 w-4" />} accent="mint">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-xs text-on-surface-variant">Couldn&apos;t load health data.</p>
      ) : rings.length === 0 ? (
        <p>No health habits configured yet.</p>
      ) : (
        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center justify-center gap-4">
            {rings.map(({ habit, progress }) => (
              <div key={habit.id} className="flex flex-col items-center gap-1">
                <ProgressRing
                  accent="mint"
                  value={progress.target > 0 ? Math.round((progress.completed / progress.target) * 100) : 0}
                  size="sm"
                  showValue
                  formatValue={() => `${progress.completed}/${progress.target}`}
                />
                <span className="text-[10px] text-on-surface-variant">{habit.name}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-outline-variant/50 pt-2">
            {lastSession ? (
              <span className="text-xs text-on-surface">
                Last: {lastSession.activity_type} · {lastSession.occurred_at.slice(0, 10)}
              </span>
            ) : (
              <span className="text-xs text-on-surface-variant">No sessions logged yet.</span>
            )}
          </div>
        </div>
      )}
    </HomeSectionCard>
  )
}
