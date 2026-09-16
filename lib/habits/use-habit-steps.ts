'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { HabitStep } from '@/lib/types'

export type HabitStepPatch = Partial<Pick<HabitStep, 'title' | 'is_core' | 'sort_order'>>

const MIGRATION_HINT = 'Has supabase/migrations/20260917020000_habit_steps.sql been run?'

// Steps for one habit, edited in place (each change saves immediately, the
// same way the Calendar routine editor works) — never part of the habit
// form's own Save.
export function useHabitSteps(habitId: string | null) {
  const [steps, setSteps] = useState<HabitStep[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!habitId) return
    supabase
      .from('habit_steps')
      .select('*')
      .eq('habit_id', habitId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        setError(fetchError ? `Couldn't load steps: ${fetchError.message}. ${MIGRATION_HINT}` : null)
        setSteps((data ?? []) as HabitStep[])
      })
  }, [habitId])

  useEffect(refresh, [refresh])

  const addStep = useCallback(
    async (title: string, isCore: boolean) => {
      const trimmed = title.trim()
      if (!habitId || !trimmed) return
      const sortOrder = steps.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1
      const { data, error: insertError } = await supabase
        .from('habit_steps')
        .insert({ habit_id: habitId, title: trimmed, is_core: isCore, sort_order: sortOrder })
        .select()
        .single()
      if (insertError || !data) {
        setError(`Couldn't add step: ${insertError?.message ?? 'unknown error'}`)
        return
      }
      setError(null)
      setSteps((prev) => [...prev, data as HabitStep])
    },
    [habitId, steps]
  )

  const updateStep = useCallback(
    async (id: string, patch: HabitStepPatch) => {
      const previous = steps
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      const { error: updateError } = await supabase.from('habit_steps').update(patch).eq('id', id)
      if (updateError) {
        setSteps(previous)
        setError(`Couldn't save step: ${updateError.message}`)
      } else {
        setError(null)
      }
    },
    [steps]
  )

  const moveStep = useCallback(
    async (id: string, direction: -1 | 1) => {
      const index = steps.findIndex((s) => s.id === id)
      const other = steps[index + direction]
      if (index === -1 || !other) return
      const reordered = steps.slice()
      reordered[index] = other
      reordered[index + direction] = steps[index]
      const renumbered = reordered.map((s, i) => ({ ...s, sort_order: i }))
      setSteps(renumbered)
      const results = await Promise.all(
        renumbered.map((s) => supabase.from('habit_steps').update({ sort_order: s.sort_order }).eq('id', s.id))
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        setError(`Couldn't reorder: ${failed.error.message}`)
        refresh()
      }
    },
    [steps, refresh]
  )

  const removeStep = useCallback(
    async (id: string) => {
      const previous = steps
      setSteps((prev) => prev.filter((s) => s.id !== id))
      const { error: deleteError } = await supabase.from('habit_steps').delete().eq('id', id)
      if (deleteError) {
        setSteps(previous)
        setError(`Couldn't delete step: ${deleteError.message}`)
      }
    },
    [steps]
  )

  return { steps, error, addStep, updateStep, moveStep, removeStep }
}
