'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Habit, HabitLog, Task } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ProgressRing from '../../ProgressRing'
import LiquidSwitch from '../../LiquidSwitch'

const DONE_STATUSES = ['Done', 'Submitted']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function startOfWeekISO() {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function endOfWeekISO() {
  const d = new Date(startOfWeekISO())
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

function isHabitMet(habit: Habit | undefined, log: HabitLog) {
  if (!habit) return false
  if (habit.is_quantifiable && habit.target_value != null) {
    return log.value != null && log.value >= habit.target_value
  }
  return log.completed
}

export default function GoalTicker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [tasksToday, setTasksToday] = useState<Task[]>([])
  const [tasksWeek, setTasksWeek] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newGoalText, setNewGoalText] = useState('')
  const [newGoalRecurrence, setNewGoalRecurrence] = useState<'daily' | 'weekly'>('daily')
  const [adding, setAdding] = useState(false)

  const today = todayISO()
  const weekStart = startOfWeekISO()
  const weekEnd = endOfWeekISO()

  const refresh = () => {
    Promise.all([
      supabase.from('habits').select('*'),
      supabase.from('habit_logs').select('*').gte('date', weekStart).lte('date', weekEnd),
      supabase.from('tasks').select('*').eq('due_date', today),
      supabase.from('tasks').select('*').gte('due_date', weekStart).lte('due_date', weekEnd),
    ]).then(([h, l, td, tw]) => {
      setHabits((h.data ?? []) as Habit[])
      setHabitLogs((l.data ?? []) as HabitLog[])
      setTasksToday((td.data ?? []) as Task[])
      setTasksWeek((tw.data ?? []) as Task[])
      setLoading(false)
    })
  }

  useEffect(refresh, []) // eslint-disable-line react-hooks/exhaustive-deps

  const todayLogs = habitLogs.filter((l) => l.date === today)

  const dailyHabits = habits.filter((h) => h.frequency_type === 'daily')
  const weeklyHabits = habits.filter((h) => h.frequency_type === 'weekly')

  const dailyHabitsDone = dailyHabits.filter((h) => {
    const log = todayLogs.find((l) => l.habit_id === h.id)
    return log && isHabitMet(h, log)
  }).length

  const weeklyHabitsDone = weeklyHabits.reduce((sum, h) => {
    const metDays = habitLogs.filter((l) => l.habit_id === h.id && isHabitMet(h, l)).length
    return sum + Math.min(metDays, h.frequency_count)
  }, 0)
  const weeklyHabitsTarget = weeklyHabits.reduce((sum, h) => sum + h.frequency_count, 0)

  const tasksTodayDone = tasksToday.filter((t) => t.status && DONE_STATUSES.includes(t.status)).length
  const tasksWeekDone = tasksWeek.filter((t) => t.status && DONE_STATUSES.includes(t.status)).length

  const todayDone = dailyHabitsDone + tasksTodayDone
  const todayTarget = dailyHabits.length + tasksToday.length

  const weekDone = weeklyHabitsDone + tasksWeekDone
  const weekTarget = weeklyHabitsTarget + tasksWeek.length

  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newGoalText.trim()
    if (!name) return
    setAdding(true)
    const { error } = await supabase.from('habits').insert({
      name,
      icon: '✓',
      description: '',
      color: '#199e70',
      frequency_type: newGoalRecurrence,
      frequency_count: 1,
      is_quantifiable: false,
    })
    setAdding(false)
    if (!error) {
      setNewGoalText('')
      refresh()
    }
  }

  return (
    <WidgetCard
      title="Daily Goals"
      icon={<Target className="h-4 w-4" />}
      accent="mint"
      className="sm:col-span-2"
    >
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-around gap-4 py-1">
            <Link href="/habits" className="group flex flex-col items-center gap-2">
              <ProgressRing value={todayDone} max={todayTarget} accent="purple">
                <span className="font-display text-sm font-bold text-on-surface">
                  {todayTarget === 0 ? '–' : `${todayDone}/${todayTarget}`}
                </span>
              </ProgressRing>
              <span className="text-xs font-medium text-on-surface-variant group-hover:text-on-surface">
                Today
              </span>
            </Link>
            <Link href="/education" className="group flex flex-col items-center gap-2">
              <ProgressRing value={weekDone} max={weekTarget} accent="orange">
                <span className="font-display text-sm font-bold text-on-surface">
                  {weekTarget === 0 ? '–' : `${weekDone}/${weekTarget}`}
                </span>
              </ProgressRing>
              <span className="text-xs font-medium text-on-surface-variant group-hover:text-on-surface">
                This Week
              </span>
            </Link>
          </div>

          <form
            onSubmit={addGoal}
            className="flex items-center gap-2 border-t border-outline-variant/50 pt-3"
          >
            <LiquidSwitch
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
              ]}
              value={newGoalRecurrence}
              onChange={setNewGoalRecurrence}
              accent="mint"
            />
            <input
              value={newGoalText}
              onChange={(e) => setNewGoalText(e.target.value)}
              placeholder="Add a goal..."
              className="min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary-container"
            />
            <button
              type="submit"
              disabled={adding || !newGoalText.trim()}
              aria-label="Add goal"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={3} />
            </button>
          </form>
        </div>
      )}
    </WidgetCard>
  )
}
