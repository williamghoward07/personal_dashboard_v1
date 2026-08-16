'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Todo } from '@/lib/types'

export interface UseTodosResult {
  todos: Todo[]
  loading: boolean
  error: string | null
  addTodo: (title: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
}

// Todos due today or still incomplete, for the Daily Goals checklist.
// Fetches a superset (`selectChecklistTodos` in ./checklist narrows it
// to the exact due-today/overdue-incomplete view) so the ring's "todos
// due today" count can also be derived client-side from the same list
// without a second query.
//
// Both mutations are optimistic: the local list updates immediately,
// then the write fires; on failure the previous state is restored and
// `error` is set. "Undo" is deliberately the same toggle — clicking a
// completed item un-completes it — rather than a separate control.
export function useTodos(todayDateKey: string): UseTodosResult {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Non-async + .then(), matching the pattern already used by the other
  // home widgets (GoalTicker, CalendarModule) — a setState call reachable
  // via `await` inside an async function invoked from an effect body
  // trips react-hooks/set-state-in-effect, but the same call inside a
  // .then() callback doesn't.
  const refresh = useCallback(() => {
    supabase
      .from('todos')
      .select('*')
      .or(`completed_at.is.null,due_date.eq.${todayDateKey}`)
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setTodos((data ?? []) as Todo[])
        }
        setLoading(false)
      })
  }, [todayDateKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addTodo = useCallback(
    async (title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return

      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimisticTodo: Todo = {
        id: optimisticId,
        title: trimmed,
        notes: null,
        due_date: todayDateKey,
        completed_at: null,
        created_at: new Date().toISOString(),
      }
      setTodos((prev) => [...prev, optimisticTodo])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('todos')
        .insert({ title: trimmed, due_date: todayDateKey })
        .select()
        .single()

      if (insertError || !data) {
        setTodos((prev) => prev.filter((t) => t.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to add todo')
        return
      }

      setTodos((prev) => prev.map((t) => (t.id === optimisticId ? (data as Todo) : t)))
    },
    [todayDateKey]
  )

  const toggleTodo = useCallback(
    async (id: string) => {
      // Read the pre-toggle row directly from current state rather than
      // capturing it as a side effect inside the setTodos updater below —
      // there's no guarantee that updater runs before this function
      // continues past the call, so a closure-captured "previous" can
      // still be undefined by the time the rollback needs it.
      const target = todos.find((t) => t.id === id)
      if (!target) return
      const nextCompletedAt = target.completed_at ? null : new Date().toISOString()

      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed_at: nextCompletedAt } : t)))
      setError(null)

      const { error: updateError } = await supabase
        .from('todos')
        .update({ completed_at: nextCompletedAt })
        .eq('id', id)

      if (updateError) {
        setTodos((prev) => prev.map((t) => (t.id === id ? target : t)))
        setError(updateError.message)
      }
    },
    [todos]
  )

  return { todos, loading, error, addTodo, toggleTodo }
}
