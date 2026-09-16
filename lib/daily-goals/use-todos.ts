'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import type { Todo } from '@/lib/types'
import type { TodoSyncChanges } from '@/lib/microsoft/todo-mapping'
import {
  pullMicrosoftTodo,
  pushTodoChange,
  pushTodoDelete,
  syncWarning,
  type TodoSyncStatus,
} from '@/lib/todos/sync-client'

export type TodoPatch = Partial<Pick<Todo, 'title' | 'notes' | 'due_date' | 'due_time' | 'list_id' | 'parent_id'>>

export interface UseTodosResult {
  todos: Todo[]
  loading: boolean
  error: string | null
  addTodo: (
    title: string,
    extra?: {
      due_date?: string | null
      due_time?: string | null
      notes?: string | null
      list_id?: string | null
      parent_id?: string | null
    }
  ) => Promise<Todo | null>
  toggleTodo: (id: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  updateTodo: (id: string, patch: TodoPatch) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  // Pulls from Microsoft To Do (app/api/microsoft/todo/pull) and
  // refreshes afterwards. Not called automatically by this hook — the
  // /todos page calls it on load, the home widget on a throttle.
  syncTodos: () => Promise<void>
  syncStatus: TodoSyncStatus
}

// Edits that are mirrored to the linked To Do task.
function syncedChanges(patch: TodoPatch): TodoSyncChanges {
  const changes: TodoSyncChanges = {}
  if (patch.title !== undefined) changes.title = patch.title
  if (patch.notes !== undefined) changes.notes = patch.notes
  if (patch.due_date !== undefined) changes.due_date = patch.due_date
  return changes
}

// Todos for either the Daily Goals checklist (scope: 'today', the
// default — incomplete, due today, or finished today, so the ring's
// "todos due today" count can also be derived client-side from the same
// list without a second query) or the full /todos management page
// (scope: 'all' — every todo, regardless of date or completion).
//
// All mutations are optimistic: the local list updates immediately,
// then the write fires; on failure the previous state is restored and
// `error` is set. "Undo" for completion is deliberately the same
// toggle — clicking a completed item un-completes it — rather than a
// separate control. Changes to a To Do-linked todo are then pushed to
// To Do; a failed push keeps the app-side change and shows a warning.
export function useTodos(todayDateKey: string, scope: 'today' | 'all' = 'today'): UseTodosResult {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<TodoSyncStatus>({ state: 'idle' })

  // Non-async + .then(), matching the pattern already used by the other
  // home widgets (GoalTicker, CalendarModule) — a setState call reachable
  // via `await` inside an async function invoked from an effect body
  // trips react-hooks/set-state-in-effect, but the same call inside a
  // .then() callback doesn't.
  const refresh = useCallback(() => {
    let query = supabase.from('todos').select('*').order('created_at', { ascending: true })
    if (scope === 'today') {
      // "Finished today" keeps a just-ticked undated (e.g. starred) todo
      // visible instead of vanishing on the next refresh.
      const todayStart = londonDayBoundsUTC().timeMin
      query = query.or(`completed_at.is.null,due_date.eq.${todayDateKey},completed_at.gte."${todayStart}"`)
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

  const pushChange = useCallback(async (todo: Todo, changes: TodoSyncChanges) => {
    if (!todo.mstodo_task_id || Object.keys(changes).length === 0) return
    const pushError = await pushTodoChange(todo.id, changes)
    if (pushError) setError(syncWarning(pushError))
  }, [])

  const addTodo = useCallback(
    async (
      title: string,
      extra?: {
        due_date?: string | null
        due_time?: string | null
        notes?: string | null
        list_id?: string | null
        parent_id?: string | null
      }
    ): Promise<Todo | null> => {
      const trimmed = title.trim()
      if (!trimmed) return null

      const dueDate = extra ? (extra.due_date ?? null) : todayDateKey
      const dueTime = extra?.due_time ?? null
      const notes = extra?.notes ?? null
      const listId = extra?.list_id ?? null
      const parentId = extra?.parent_id ?? null

      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimisticTodo: Todo = {
        id: optimisticId,
        title: trimmed,
        notes,
        due_date: dueDate,
        due_time: dueTime,
        completed_at: null,
        created_at: new Date().toISOString(),
        caldav_uid: null,
        // Todos added through this function are always app-created —
        // never linked to a To Do task.
        mstodo_task_id: null,
        mstodo_list_id: null,
        starred: false,
        list_id: listId,
        parent_id: parentId,
        // Only ever set by the Education notes-document feature, which
        // writes directly via Supabase rather than through this hook.
        notes_document_id: null,
        // Only ever set by the Workspaces feature, which writes directly
        // via Supabase rather than through this hook.
        workspace_id: null,
      }
      setTodos((prev) => [...prev, optimisticTodo])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('todos')
        .insert({ title: trimmed, due_date: dueDate, due_time: dueTime, notes, list_id: listId, parent_id: parentId })
        .select()
        .single()

      if (insertError || !data) {
        setTodos((prev) => prev.filter((t) => t.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to add todo')
        return null
      }

      setTodos((prev) => prev.map((t) => (t.id === optimisticId ? (data as Todo) : t)))
      return data as Todo
    },
    [todayDateKey]
  )

  // Shared optimistic single-row update with rollback.
  const applyPatch = useCallback(
    async (id: string, patch: Partial<Todo>): Promise<Todo | null> => {
      // Read the pre-update row directly from current state rather than
      // capturing it inside the setTodos updater — there's no guarantee
      // that updater runs before this function continues.
      const target = todos.find((t) => t.id === id)
      if (!target) return null

      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      setError(null)

      const { error: updateError } = await supabase.from('todos').update(patch).eq('id', id)
      if (updateError) {
        setTodos((prev) => prev.map((t) => (t.id === id ? target : t)))
        setError(updateError.message)
        return null
      }
      return target
    },
    [todos]
  )

  const toggleTodo = useCallback(
    async (id: string) => {
      const current = todos.find((t) => t.id === id)
      if (!current) return
      const nextCompletedAt = current.completed_at ? null : new Date().toISOString()
      const target = await applyPatch(id, { completed_at: nextCompletedAt })
      if (target) await pushChange(target, { completed: nextCompletedAt !== null })
    },
    [todos, applyPatch, pushChange]
  )

  const toggleStar = useCallback(
    async (id: string) => {
      const current = todos.find((t) => t.id === id)
      if (!current) return
      const target = await applyPatch(id, { starred: !current.starred })
      if (target) await pushChange(target, { starred: !current.starred })
    },
    [todos, applyPatch, pushChange]
  )

  const updateTodo = useCallback(
    async (id: string, patch: TodoPatch) => {
      const target = await applyPatch(id, patch)
      if (target) await pushChange(target, syncedChanges(patch))
    },
    [applyPatch, pushChange]
  )

  const syncTodos = useCallback(async () => {
    setSyncStatus((prev) => ({ ...prev, state: 'syncing' }))
    const status = await pullMicrosoftTodo()
    setSyncStatus(status)
    if (status.state === 'ok') refresh()
  }, [refresh])

  const deleteTodo = useCallback(
    async (id: string) => {
      const index = todos.findIndex((t) => t.id === id)
      if (index === -1) return
      const target = todos[index]

      // Delete the To Do task first — if that fails, keep the todo, or
      // the next pull would quietly bring it back.
      if (target.mstodo_task_id) {
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

  return { todos, loading, error, addTodo, toggleTodo, toggleStar, updateTodo, deleteTodo, syncTodos, syncStatus }
}
