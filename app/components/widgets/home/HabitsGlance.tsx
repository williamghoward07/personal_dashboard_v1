'use client'

import { useEffect, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Habit, HabitLog } from '@/lib/types'
import HomeSectionCard from './HomeSectionCard'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function HabitsGlance() {
  const [habitCount, setHabitCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayISO()
    Promise.all([
      supabase.from('habits').select('*'),
      supabase.from('habit_logs').select('*').eq('date', today),
    ]).then(([h, l]) => {
      const habits = (h.data ?? []) as Habit[]
      const logs = (l.data ?? []) as HabitLog[]
      const habitsById = new Map(habits.map((x) => [x.id, x]))

      const met = logs.filter((log) => {
        const habit = habitsById.get(log.habit_id)
        if (!habit) return false
        if (habit.is_quantifiable && habit.target_value != null) {
          return log.value != null && log.value >= habit.target_value
        }
        return log.completed
      }).length

      setHabitCount(habits.length)
      setDoneCount(met)
      setLoading(false)
    })
  }, [])

  return (
    <HomeSectionCard href="/habits" title="Habits" icon={<ListChecks className="h-4 w-4" />} accent="purple">
      {loading ? (
        <p>Loading...</p>
      ) : habitCount === 0 ? (
        <p>No habits yet.</p>
      ) : (
        <p className="text-on-surface">
          {doneCount}/{habitCount} done today
        </p>
      )}
    </HomeSectionCard>
  )
}
