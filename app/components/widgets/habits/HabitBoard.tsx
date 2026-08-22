'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, ListChecks } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { supabase } from '@/lib/supabase'
import type { DailyGoalHabit, DailyGoalHabitCompletion } from '@/lib/types'
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
  'Have you run supabase/migrations/20260816010000_daily_goal_habits_full_shape.sql in the Supabase SQL editor yet?'

interface HabitCell {
  habit: DailyGoalHabit
  date: string
}

export default function HabitBoard() {
  const [habits, setHabits] = useState<DailyGoalHabit[]>([])
  const [completions, setCompletions] = useState<DailyGoalHabitCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<DailyGoalHabit | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<DailyGoalHabit | null>(null)
  const [loggingCell, setLoggingCell] = useState<HabitCell | null>(null)
  const [confirmingCell, setConfirmingCell] = useState<HabitCell | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const refresh = () => {
    setLoading(true)
    Promise.all([
      supabase
        .from('daily_goal_habits')
        .select('*')
        .eq('widget', 'habits')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('daily_goal_habit_completions').select('*').gte('completed_on', daysAgoISO(97)),
    ]).then(([h, c]) => {
      if (h.error) {
        setError(`Couldn't load habits: ${h.error.message}. ${MIGRATION_HINT}`)
      } else if (c.error) {
        setError(`Couldn't load habit history: ${c.error.message}. ${MIGRATION_HINT}`)
      } else {
        setError(null)
      }
      setHabits((h.data ?? []) as DailyGoalHabit[])
      // Completions aren't filtered to widget='habits' at the query level
      // — the habitsById lookup below already discards any row whose
      // habit_id isn't one of this widget's habits (e.g. Health's
      // Running/Gym completions), so a second round-trip isn't needed.
      setCompletions((c.data ?? []) as DailyGoalHabitCompletion[])
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const habitsById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits])

  const statusByHabit = useMemo(() => {
    const map = new Map<string, Map<string, HabitDayStatus>>()
    for (const completion of completions) {
      const habit = habitsById.get(completion.habit_id)
      if (!habit) continue

      let status: HabitDayStatus | null = null
      if (habit.is_quantifiable && habit.target_value != null) {
        if (completion.value != null) status = completion.value >= habit.target_value ? 'met' : 'partial'
      } else {
        // Non-quantifiable habits only ever get a completion row when
        // done (toggling off deletes the row rather than un-setting a
        // flag), so the row existing at all means met.
        status = 'met'
      }
      if (!status) continue

      if (!map.has(completion.habit_id)) map.set(completion.habit_id, new Map())
      map.get(completion.habit_id)!.set(completion.completed_on, status)
    }
    return map
  }, [completions, habitsById])

  const todayValueByHabit = useMemo(() => {
    const today = todayISO()
    const map = new Map<string, number | null>()
    for (const completion of completions) {
      if (completion.completed_on === today) map.set(completion.habit_id, completion.value)
    }
    return map
  }, [completions])

  const valueForDate = (habitId: string, date: string): number | null =>
    completions.find((c) => c.habit_id === habitId && c.completed_on === date)?.value ?? null

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

  const toggleDate = async (habit: DailyGoalHabit, date: string) => {
    const done = statusByHabit.get(habit.id)?.get(date) === 'met'

    const ok = await runMutation(() =>
      done
        ? supabase
            .from('daily_goal_habit_completions')
            .delete()
            .eq('habit_id', habit.id)
            .eq('completed_on', date)
        : supabase
            .from('daily_goal_habit_completions')
            .upsert({ habit_id: habit.id, completed_on: date }, { onConflict: 'habit_id,completed_on' }),
    )
    if (ok) refresh()
  }

  const logDate = async (habit: DailyGoalHabit, date: string, value: number) => {
    const ok = await runMutation(() =>
      supabase
        .from('daily_goal_habit_completions')
        .upsert({ habit_id: habit.id, completed_on: date, value }, { onConflict: 'habit_id,completed_on' }),
    )
    if (ok) {
      setLoggingCell(null)
      refresh()
    }
  }

  // Single entry point for "the user acted on habit X for date Y",
  // whether that came from the header's quick-action button (always
  // today) or a heatmap cell (today or a past day — future cells are
  // disabled before this is ever reached). Quantifiable habits always
  // open the value modal, whose own Save/Cancel is the confirm step;
  // plain habits toggle instantly on today (unchanged, frictionless) but
  // need an explicit confirm on a past day, since there's no undo-visible
  // affordance the way an open modal provides.
  const handleCellClick = (habit: DailyGoalHabit, date: string) => {
    if (habit.is_quantifiable) {
      setLoggingCell({ habit, date })
    } else if (date === todayISO()) {
      toggleDate(habit, date)
    } else {
      setConfirmingCell({ habit, date })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = habits.findIndex((h) => h.id === active.id)
    const newIndex = habits.findIndex((h) => h.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(habits, oldIndex, newIndex)
    setHabits(reordered)

    const results = await Promise.all(
      reordered.map((h, i) => supabase.from('daily_goal_habits').update({ sort_order: i }).eq('id', h.id))
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      setError(`Couldn't save new order: ${failed.error.message}`)
      refresh()
    }
  }

  const confirmingWasCompleted = confirmingCell
    ? statusByHabit.get(confirmingCell.habit.id)?.get(confirmingCell.date) === 'met'
    : false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-headline-lg font-bold text-habit-purple">
            <ListChecks className="h-6 w-6" />
            Habits
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">Daily and weekly habit tracking.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add habit"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-habit-purple"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No habits yet — add one to get started.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={habits.map((h) => h.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  statusByDate={statusByHabit.get(habit.id) ?? new Map()}
                  todayValue={todayValueByHabit.get(habit.id) ?? null}
                  onCellClick={(date) => handleCellClick(habit, date)}
                  onEdit={() => setEditingHabit(habit)}
                  onDelete={() => setDeletingHabit(habit)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <HabitFormModal
        isOpen={isAddOpen}
        heading="New habit"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          const ok = await runMutation(() =>
            supabase.from('daily_goal_habits').insert({ ...values, widget: 'habits' }),
          )
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
            supabase.from('daily_goal_habits').update(values).eq('id', editingHabit.id),
          )
          if (ok) {
            setEditingHabit(null)
            refresh()
          }
        }}
      />

      <HabitLogValueModal
        isOpen={loggingCell !== null}
        habit={loggingCell?.habit ?? null}
        date={loggingCell?.date}
        initialValue={loggingCell ? valueForDate(loggingCell.habit.id, loggingCell.date) : null}
        onClose={() => setLoggingCell(null)}
        onSave={(value) => {
          if (loggingCell) logDate(loggingCell.habit, loggingCell.date, value)
        }}
      />

      <ConfirmDialog
        isOpen={confirmingCell !== null}
        message={`Mark "${confirmingCell?.habit.name}" ${
          confirmingWasCompleted ? 'not done' : 'done'
        } on ${confirmingCell?.date}?`}
        confirmLabel={confirmingWasCompleted ? 'Mark not done' : 'Mark done'}
        onCancel={() => setConfirmingCell(null)}
        onConfirm={() => {
          if (!confirmingCell) return
          toggleDate(confirmingCell.habit, confirmingCell.date)
          setConfirmingCell(null)
        }}
      />

      <ConfirmDialog
        isOpen={deletingHabit !== null}
        message={`Delete "${deletingHabit?.name}"? This can't be undone.`}
        onCancel={() => setDeletingHabit(null)}
        onConfirm={async () => {
          if (!deletingHabit) return
          const ok = await runMutation(() =>
            supabase.from('daily_goal_habits').delete().eq('id', deletingHabit.id),
          )
          if (ok) {
            setDeletingHabit(null)
            refresh()
          }
        }}
      />
    </div>
  )
}
