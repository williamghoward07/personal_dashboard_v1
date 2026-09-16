'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyGoalHabit, DailyGoalHabitCompletion, HabitStep, HabitStepCheck } from '@/lib/types'
import { londonDayBoundsUTC, londonWeekBoundsUTC } from '@/lib/google/london-day'
import { notifyHabitsChanged, useHabitsVersion } from './events'
import { MORNING_CUTOFF_HOUR, isPastCutoff, shiftDateKey } from './steps'

// Far enough back for the "missed the last two" check on a habit that
// only runs a couple of days a week.
const LOOKBACK_DAYS = 14

export interface RoutineData {
  habit: DailyGoalHabit
  steps: HabitStep[]
}

export interface NewRoutine {
  name: string
  weeklyTarget: number
  coreSteps: string[]
  bonusSteps: string[]
}

function readClock() {
  const day = londonDayBoundsUTC()
  return {
    todayKey: day.startDateKey,
    weekStartKey: londonWeekBoundsUTC().startDateKey,
    pastCutoff: isPastCutoff(new Date(), MORNING_CUTOFF_HOUR),
  }
}

// Habits with steps (the morning routine), today's ticks and recent
// completions, for the home card. Ticking goes through the
// set_habit_step_check RPC, which also logs/removes the habit completion.
export function useMorningRoutines() {
  // Read once per mount — a card left open overnight shows yesterday until reload.
  const clock = useMemo(() => readClock(), [])
  const habitsVersion = useHabitsVersion()
  const [routines, setRoutines] = useState<RoutineData[]>([])
  const [checks, setChecks] = useState<HabitStepCheck[]>([])
  const [completions, setCompletions] = useState<DailyGoalHabitCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return Promise.all([
      supabase
        .from('daily_goal_habits')
        .select('*')
        .eq('widget', 'habits')
        .eq('is_active', true)
        .eq('is_quantifiable', false)
        .order('sort_order', { ascending: true }),
      supabase.from('habit_steps').select('*').order('sort_order', { ascending: true }),
      supabase.from('habit_step_checks').select('*').eq('checked_on', clock.todayKey),
      supabase
        .from('daily_goal_habit_completions')
        .select('*')
        .gte('completed_on', shiftDateKey(clock.todayKey, -LOOKBACK_DAYS))
        .lte('completed_on', clock.todayKey),
    ]).then(([h, s, k, c]) => {
      const firstError = h.error ?? s.error ?? k.error ?? c.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }
      const steps = (s.data ?? []) as HabitStep[]
      setRoutines(
        ((h.data ?? []) as DailyGoalHabit[])
          .map((habit) => ({ habit, steps: steps.filter((step) => step.habit_id === habit.id) }))
          .filter((r) => r.steps.length > 0)
      )
      setChecks((k.data ?? []) as HabitStepCheck[])
      setCompletions((c.data ?? []) as DailyGoalHabitCompletion[])
      setError(null)
      setLoading(false)
    })
  }, [clock.todayKey])

  useEffect(() => {
    void load()
  }, [load, habitsVersion])

  const toggleStep = useCallback(
    async (step: HabitStep, checked: boolean) => {
      const previous = checks
      setChecks((prev) =>
        checked
          ? [...prev, { id: `optimistic-${step.id}`, step_id: step.id, habit_id: step.habit_id, checked_on: clock.todayKey, created_at: '' }]
          : prev.filter((c) => c.step_id !== step.id)
      )
      const { error: rpcError } = await supabase.rpc('set_habit_step_check', {
        p_step: step.id,
        p_day: clock.todayKey,
        p_checked: checked,
      })
      if (rpcError) {
        setChecks(previous)
        setError(`Couldn't save: ${rpcError.message}`)
        return
      }
      // Reloads this card too (it listens to the same version).
      notifyHabitsChanged()
    },
    [checks, clock.todayKey]
  )

  return { ...clock, routines, checks, completions, loading, error, toggleStep }
}

/** Creates a times-per-week habit with its steps. Returns an error message, or null. */
export async function createMorningRoutine(routine: NewRoutine): Promise<string | null> {
  const { data: habit, error: habitError } = await supabase
    .from('daily_goal_habits')
    .insert({
      name: routine.name.trim() || 'Morning routine',
      icon: '🌅',
      description: 'Core steps make the day count; bonus steps are extra.',
      colour: '#9085e9',
      frequency_type: 'times_per_week',
      weekly_target: routine.weeklyTarget,
      widget: 'habits',
    })
    .select('id')
    .single()
  if (habitError || !habit) return habitError?.message ?? "Couldn't create the routine."

  const rows = [
    ...routine.coreSteps.map((title) => ({ title, is_core: true })),
    ...routine.bonusSteps.map((title) => ({ title, is_core: false })),
  ]
    .filter((r) => r.title.trim())
    .map((r, i) => ({ habit_id: habit.id, title: r.title.trim(), is_core: r.is_core, sort_order: i }))

  if (rows.length > 0) {
    const { error: stepsError } = await supabase.from('habit_steps').insert(rows)
    if (stepsError) return `Routine created, but its steps weren't: ${stepsError.message}`
  }
  notifyHabitsChanged()
  return null
}
