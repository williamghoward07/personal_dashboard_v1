'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Habit, HabitLog } from '@/lib/types'
import type { HabitDayStatus } from './HabitHeatmap'
import ConfirmDialog from '../../ConfirmDialog'
import HabitCard from './HabitCard'
import HabitFormModal from './HabitFormModal'
import HabitLogValueModal from './HabitLogValueModal'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const MIGRATION_HINT =
  'Have you run supabase/migrations/20260804000000_habits.sql in the Supabase SQL editor yet?'

export default function HabitBoard() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null)
  const [loggingHabit, setLoggingHabit] = useState<Habit | null>(null)

  const refresh = () => {
    setLoading(true)
    Promise.all([
      supabase.from('habits').select('*').order('created_at', { ascending: true }),
      supabase.from('habit_logs').select('*').gte('date', daysAgoISO(97)),
    ]).then(([h, l]) => {
      if (h.error) {
        setError(`Couldn't load habits: ${h.error.message}. ${MIGRATION_HINT}`)
      } else if (l.error) {
        setError(`Couldn't load habit history: ${l.error.message}. ${MIGRATION_HINT}`)
      } else {
        setError(null)
      }
      setHabits(h.data ?? [])
      setLogs(l.data ?? [])
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const habitsById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits])

  const statusByHabit = useMemo(() => {
    const map = new Map<string, Map<string, HabitDayStatus>>()
    for (const log of logs) {
      const habit = habitsById.get(log.habit_id)
      if (!habit) continue

      let status: HabitDayStatus | null = null
      if (habit.is_quantifiable && habit.target_value != null) {
        if (log.value != null) status = log.value >= habit.target_value ? 'met' : 'partial'
      } else if (log.completed) {
        status = 'met'
      }
      if (!status) continue

      if (!map.has(log.habit_id)) map.set(log.habit_id, new Map())
      map.get(log.habit_id)!.set(log.date, status)
    }
    return map
  }, [logs, habitsById])

  const todayValueByHabit = useMemo(() => {
    const today = todayISO()
    const map = new Map<string, number | null>()
    for (const log of logs) {
      if (log.date === today) map.set(log.habit_id, log.value)
    }
    return map
  }, [logs])

  const runMutation = async (
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    const { error: mutationError } = await fn()
    if (mutationError) {
      setError(`Couldn't save: ${mutationError.message}. ${MIGRATION_HINT}`)
      return false
    }
    setError(null)
    return true
  }

  const toggleToday = async (habit: Habit) => {
    const today = todayISO()
    const done = statusByHabit.get(habit.id)?.get(today) === 'met'

    const ok = await runMutation(() =>
      done
        ? supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('date', today)
        : supabase
            .from('habit_logs')
            .upsert(
              { habit_id: habit.id, date: today, completed: true },
              { onConflict: 'habit_id,date' },
            ),
    )
    if (ok) refresh()
  }

  const logToday = async (habit: Habit, value: number) => {
    const today = todayISO()
    const completed = habit.target_value != null ? value >= habit.target_value : true
    const ok = await runMutation(() =>
      supabase
        .from('habit_logs')
        .upsert(
          { habit_id: habit.id, date: today, value, completed },
          { onConflict: 'habit_id,date' },
        ),
    )
    if (ok) {
      setLoggingHabit(null)
      refresh()
    }
  }

  return (
    <main className="flex-1 px-8 py-6" style={{ backgroundColor: '#0b0f1a' }}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Habit tracker</h1>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add habit"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading...</p>
        ) : habits.length === 0 ? (
          <p className="text-sm text-white/40">No habits yet — add one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                statusByDate={statusByHabit.get(habit.id) ?? new Map()}
                todayValue={todayValueByHabit.get(habit.id) ?? null}
                onToggleToday={() => toggleToday(habit)}
                onLogToday={() => setLoggingHabit(habit)}
                onEdit={() => setEditingHabit(habit)}
                onDelete={() => setDeletingHabit(habit)}
              />
            ))}
          </div>
        )}
      </div>

      <HabitFormModal
        isOpen={isAddOpen}
        heading="New habit"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          const ok = await runMutation(() => supabase.from('habits').insert(values))
          if (ok) {
            setIsAddOpen(false)
            refresh()
          }
        }}
      />

      <HabitFormModal
        isOpen={editingHabit !== null}
        heading="Edit habit"
        initialValues={editingHabit}
        onClose={() => setEditingHabit(null)}
        onSave={async (values) => {
          if (!editingHabit) return
          const ok = await runMutation(() =>
            supabase.from('habits').update(values).eq('id', editingHabit.id),
          )
          if (ok) {
            setEditingHabit(null)
            refresh()
          }
        }}
      />

      <HabitLogValueModal
        isOpen={loggingHabit !== null}
        habit={loggingHabit}
        initialValue={loggingHabit ? (todayValueByHabit.get(loggingHabit.id) ?? null) : null}
        onClose={() => setLoggingHabit(null)}
        onSave={(value) => {
          if (loggingHabit) logToday(loggingHabit, value)
        }}
      />

      <ConfirmDialog
        isOpen={deletingHabit !== null}
        message={`Delete "${deletingHabit?.name}"? This can't be undone.`}
        onCancel={() => setDeletingHabit(null)}
        onConfirm={async () => {
          if (!deletingHabit) return
          const ok = await runMutation(() =>
            supabase.from('habits').delete().eq('id', deletingHabit.id),
          )
          if (ok) {
            setDeletingHabit(null)
            refresh()
          }
        }}
        variant="dark"
      />
    </main>
  )
}
