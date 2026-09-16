'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Todo } from '@/lib/types'

export interface UseWorkspaceTodosResult {
  todos: Todo[]
  loading: boolean
  error: string | null
  refresh: () => void
  addTodo: (title: string) => Promise<void>
  attachTodos: (todoIds: string[]) => Promise<void>
  detachTodo: (id: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
}

// Todos scoped to one workspace via todos.workspace_id. A standalone hook
// rather than a third `scope` on lib/daily-goals/use-todos.ts — that
// hook's addTodo already bakes in "today"-scoped date defaults that don't
// apply here, and toggle/delete are simple enough to duplicate rather
// than thread a new parameter through an already-busy signature.
export function useWorkspaceTodos(workspaceId: string): UseWorkspaceTodosResult {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('todos')
      .select('*')
      .eq('workspace_id', workspaceId)
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
  }, [workspaceId])

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
        due_date: null,
        due_time: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        caldav_uid: null,
        list_id: null,
        parent_id: null,
        notes_document_id: null,
        workspace_id: workspaceId,
      }
      setTodos((prev) => [...prev, optimisticTodo])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('todos')
        .insert({ title: trimmed, workspace_id: workspaceId })
        .select()
        .single()

      if (insertError || !data) {
        setTodos((prev) => prev.filter((t) => t.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to add todo')
        return
      }

      setTodos((prev) => prev.map((t) => (t.id === optimisticId ? (data as Todo) : t)))
    },
    [workspaceId]
  )

  const attachTodos = useCallback(
    async (todoIds: string[]) => {
      if (todoIds.length === 0) return
      setError(null)

      const { data, error: updateError } = await supabase
        .from('todos')
        .update({ workspace_id: workspaceId })
        .in('id', todoIds)
        .select()

      if (updateError) {
        setError(updateError.message)
        return
      }

      setTodos((prev) => [...prev, ...((data ?? []) as Todo[])])
    },
    [workspaceId]
  )

  const detachTodo = useCallback(
    async (id: string) => {
      const index = todos.findIndex((t) => t.id === id)
      if (index === -1) return
      const target = todos[index]

      setTodos((prev) => prev.filter((t) => t.id !== id))
      setError(null)

      const { error: updateError } = await supabase.from('todos').update({ workspace_id: null }).eq('id', id)

      if (updateError) {
        setTodos((prev) => {
          const next = [...prev]
          next.splice(index, 0, target)
          return next
        })
        setError(updateError.message)
      }
    },
    [todos]
  )

  const toggleTodo = useCallback(
    async (id: string) => {
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

  const deleteTodo = useCallback(
    async (id: string) => {
      const index = todos.findIndex((t) => t.id === id)
      if (index === -1) return
      const target = todos[index]

      setTodos((prev) => prev.filter((t) => t.id !== id))
      setError(null)

      const { error: deleteError } = await supabase.from('todos').delete().eq('id', id)

      if (deleteError) {
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

  return { todos, loading, error, refresh, addTodo, attachTodos, detachTodo, toggleTodo, deleteTodo }
}
