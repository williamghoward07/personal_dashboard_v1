'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Todo } from '@/lib/types'

export interface UseTodosResult {
  todos: Todo[]
  loading: boolean
  error: string | null
  addTodo: (
    title: string,
    extra?: { due_date?: string | null; notes?: string | null; list_id?: string | null; parent_id?: string | null }
  ) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  updateTodo: (
    id: string,
    patch: Partial<Pick<Todo, 'title' | 'notes' | 'due_date' | 'list_id' | 'parent_id'>>
  ) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  // Pulls from Apple Reminders (see app/api/caldav/reminders/pull) and
  // refreshes afterward. Not called automatically by this hook — the
  // /todos page triggers it on load; the home widget doesn't, so opening
  // the dashboard never blocks on an iCloud round trip.
  pullReminders: () => Promise<void>
}

// Todos for either the Daily Goals checklist (scope: 'today', the
// default — due today or still incomplete, so the ring's "todos due
// today" count can also be derived client-side from the same list
// without a second query) or the full /todos management page
// (scope: 'all' — every todo, regardless of date or completion).
//
// All mutations are optimistic: the local list updates immediately,
// then the write fires; on failure the previous state is restored and
// `error` is set. "Undo" for completion is deliberately the same
// toggle — clicking a completed item un-completes it — rather than a
// separate control.
export function useTodos(todayDateKey: string, scope: 'today' | 'all' = 'today'): UseTodosResult {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Non-async + .then(), matching the pattern already used by the other
  // home widgets (GoalTicker, CalendarModule) — a setState call reachable
  // via `await` inside an async function invoked from an effect body
  // trips react-hooks/set-state-in-effect, but the same call inside a
  // .then() callback doesn't.
  const refresh = useCallback(() => {
    let query = supabase.from('todos').select('*').order('created_at', { ascending: true })
    if (scope === 'today') {
      query = query.or(`completed_at.is.null,due_date.eq.${todayDateKey}`)
    }
    query.then(({ data, error: fetchError }) => {
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setError(null)
        setTodos((data ?? []) as Todo[])
      }
      setLoading(false)
    })
  }, [todayDateKey, scope])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addTodo = useCallback(
    async (
      title: string,
      extra?: { due_date?: string | null; notes?: string | null; list_id?: string | null; parent_id?: string | null }
    ) => {
      const trimmed = title.trim()
      if (!trimmed) return

      const dueDate = extra ? (extra.due_date ?? null) : todayDateKey
      const notes = extra?.notes ?? null
      const listId = extra?.list_id ?? null
      const parentId = extra?.parent_id ?? null

      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimisticTodo: Todo = {
        id: optimisticId,
        title: trimmed,
        notes,
        due_date: dueDate,
        completed_at: null,
        created_at: new Date().toISOString(),
        // Todos added through this function are always app-created —
        // never linked to a reminder.
        caldav_uid: null,
        list_id: listId,
        parent_id: parentId,
      }
      setTodos((prev) => [...prev, optimisticTodo])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('todos')
        .insert({ title: trimmed, due_date: dueDate, notes, list_id: listId, parent_id: parentId })
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
        return
      }

      // Best-effort: the local toggle already succeeded and stays even
      // if pushing the completion back to Reminders fails — a stale
      // Reminders entry is a minor inconvenience, not a reason to undo
      // what the user just did in the app.
      if (target.caldav_uid) {
        try {
          const res = await fetch('/api/caldav/reminders/push-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caldav_uid: target.caldav_uid, completed: nextCompletedAt !== null }),
          })
          if (!res.ok) setError("Updated here, but couldn't sync that to Reminders.")
        } catch {
          setError("Updated here, but couldn't sync that to Reminders.")
        }
      }
    },
    [todos]
  )

  const pullReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/caldav/reminders/pull', { method: 'POST' })
      if (res.ok) refresh()
    } catch {
      // Silent — CalDAV sync is a nice-to-have layered on top of the
      // todos page, not something that should interrupt it (e.g. the env
      // vars simply aren't configured yet, which is expected until the
      // user sets up an app-specific password).
    }
  }, [refresh])

  const updateTodo = useCallback(
    async (id: string, patch: Partial<Pick<Todo, 'title' | 'notes' | 'due_date' | 'list_id' | 'parent_id'>>) => {
      const target = todos.find((t) => t.id === id)
      if (!target) return

      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      setError(null)

      const { error: updateError } = await supabase.from('todos').update(patch).eq('id', id)

      if (updateError) {
        setTodos((prev) => prev.map((t) => (t.id === id ? target : t)))
        setError(updateError.message)
      }
    },
    [todos]
  )

  const deleteTodo = useCallback(
    async (id: string) => {
      const index = todos.findIndex((t) => t.id === id)
      if (index === -1) return
      const target = todos[index]

      setTodos((prev) => prev.filter((t) => t.id !== id))
      setError(null)

      const { error: deleteError } = await supabase.from('todos').delete().eq('id', id)

      if (deleteError) {
        // Restore at its original position rather than appending, so a
        // failed delete doesn't reorder the list out from under the user.
        setTodos((prev) => {
          const next = [...prev]
          next.splice(index, 0, target)
          return next
        })
        setError(deleteError.message)
      }
    },
    [todos]
  )

  return { todos, loading, error, addTodo, toggleTodo, updateTodo, deleteTodo, pullReminders }
}
