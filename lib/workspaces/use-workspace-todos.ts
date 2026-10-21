'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Todo } from '@/lib/types'
import type { TodoSyncChanges } from '@/lib/microsoft/todo-mapping'
import {
  isOptimisticId,
  pushTodoChange,
  pushTodoCreate,
  pushTodoDelete,
  syncWarning,
} from '@/lib/todos/sync-client'
import { syncedChanges, type TodoPatch, type TodoSyncIds } from '@/lib/todos/patch'

export interface UseWorkspaceTodosResult {
  todos: Todo[]
  loading: boolean
  error: string | null
  refresh: () => void
  addTodo: (title: string) => Promise<void>
  attachTodos: (todoIds: string[]) => Promise<void>
  detachTodo: (id: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  updateTodo: (id: string, patch: TodoPatch) => Promise<void>
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

  const mergeIds = useCallback((id: string, ids: TodoSyncIds | null | undefined) => {
    if (!ids) return
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...ids } : t)))
  }, [])

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
        mstodo_task_id: null,
        mstodo_list_id: null,
        mstodo_checklist_item_id: null,
        starred: false,
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
      void pushTodoCreate(data.id).then((outcome) => mergeIds(data.id, outcome.ids))
    },
    [workspaceId, mergeIds]
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

  // Optimistic single-field update, rolled back on failure, then mirrored
  // to To Do for linked todos.
  const patchAndPush = useCallback(
    async (id: string, patch: Partial<Todo>, changes: TodoSyncChanges) => {
      const target = todos.find((t) => t.id === id)
      if (!target) return

      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      setError(null)

      const { error: updateError } = await supabase.from('todos').update(patch).eq('id', id)

      if (updateError) {
        setTodos((prev) => prev.map((t) => (t.id === id ? target : t)))
        setError(updateError.message)
        return
      }

      if (Object.keys(changes).length > 0 && !isOptimisticId(id)) {
        const outcome = await pushTodoChange(id, changes)
        if (outcome.error) setError(syncWarning(outcome.error))
        mergeIds(id, outcome.ids)
      }
    },
    [todos, mergeIds]
  )

  const toggleTodo = useCallback(
    async (id: string) => {
      const target = todos.find((t) => t.id === id)
      if (!target) return
      const nextCompletedAt = target.completed_at ? null : new Date().toISOString()
      await patchAndPush(id, { completed_at: nextCompletedAt }, { completed: nextCompletedAt !== null })
    },
    [todos, patchAndPush]
  )

  const toggleStar = useCallback(
    async (id: string) => {
      const target = todos.find((t) => t.id === id)
      if (!target) return
      await patchAndPush(id, { starred: !target.starred }, { starred: !target.starred })
    },
    [todos, patchAndPush]
  )

  // A todo moved to another workspace (or none) leaves this list.
  const updateTodo = useCallback(
    async (id: string, patch: TodoPatch) => {
      await patchAndPush(id, patch, syncedChanges(patch))
      if (patch.workspace_id !== undefined && patch.workspace_id !== workspaceId) {
        setTodos((prev) => prev.filter((t) => t.id !== id))
      }
    },
    [patchAndPush, workspaceId]
  )

  const deleteTodo = useCallback(
    async (id: string) => {
      const index = todos.findIndex((t) => t.id === id)
      if (index === -1) return
      const target = todos[index]

      // Same rule as the Todos page: delete the To Do task first, or the
      // next pull would bring the todo back.
      if (!isOptimisticId(id)) {
        const pushError = await pushTodoDelete(id)
        if (pushError) {
          setError(`Not deleted — Microsoft To Do: ${pushError}`)
          return
        }
      }

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

  return {
    todos,
    loading,
    error,
    refresh,
    addTodo,
    attachTodos,
    detachTodo,
    toggleTodo,
    toggleStar,
    updateTodo,
    deleteTodo,
  }
}
