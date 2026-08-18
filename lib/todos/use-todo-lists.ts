'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TodoList } from '@/lib/types'

export interface UseTodoListsResult {
  lists: TodoList[]
  loading: boolean
  error: string | null
  refresh: () => void
  createList: (name: string, color: string) => Promise<TodoList | null>
  updateList: (id: string, patch: { name: string; color: string }) => Promise<void>
  reorderLists: (orderedIds: string[]) => Promise<void>
  deleteList: (id: string) => Promise<void>
}

// Lists for the /todos page's filter-chip row + the list picker in
// TodoFormModal. All mutations are optimistic with rollback, matching
// lib/daily-goals/use-todos.ts's established shape (read "previous" from
// current state before mutating, restore on failure).
export function useTodoLists(): UseTodoListsResult {
  const [lists, setLists] = useState<TodoList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('todo_lists')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setLists((data ?? []) as TodoList[])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createList = useCallback(
    async (name: string, color: string) => {
      const trimmed = name.trim()
      if (!trimmed) return null

      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimisticList: TodoList = {
        id: optimisticId,
        name: trimmed,
        color,
        sort_order: lists.length,
        created_at: new Date().toISOString(),
      }
      setLists((prev) => [...prev, optimisticList])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('todo_lists')
        .insert({ name: trimmed, color, sort_order: lists.length })
        .select()
        .single()

      if (insertError || !data) {
        setLists((prev) => prev.filter((l) => l.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to create list')
        return null
      }

      const created = data as TodoList
      setLists((prev) => prev.map((l) => (l.id === optimisticId ? created : l)))
      return created
    },
    [lists]
  )

  const updateList = useCallback(
    async (id: string, patch: { name: string; color: string }) => {
      const target = lists.find((l) => l.id === id)
      if (!target) return
      const trimmed = patch.name.trim()
      if (!trimmed) return

      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: trimmed, color: patch.color } : l)))
      setError(null)

      const { error: updateError } = await supabase
        .from('todo_lists')
        .update({ name: trimmed, color: patch.color })
        .eq('id', id)

      if (updateError) {
        setLists((prev) => prev.map((l) => (l.id === id ? target : l)))
        setError(updateError.message)
      }
    },
    [lists]
  )

  const reorderLists = useCallback(
    async (orderedIds: string[]) => {
      const previous = lists
      const reordered = orderedIds
        .map((id, index) => {
          const list = lists.find((l) => l.id === id)
          return list ? { ...list, sort_order: index } : null
        })
        .filter((l): l is TodoList => l !== null)

      setLists(reordered)
      setError(null)

      const results = await Promise.all(
        reordered.map((l) => supabase.from('todo_lists').update({ sort_order: l.sort_order }).eq('id', l.id))
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        setLists(previous)
        setError(failed.error.message)
      }
    },
    [lists]
  )

  const deleteList = useCallback(
    async (id: string) => {
      const index = lists.findIndex((l) => l.id === id)
      if (index === -1) return
      const target = lists[index]

      setLists((prev) => prev.filter((l) => l.id !== id))
      setError(null)

      const { error: deleteError } = await supabase.from('todo_lists').delete().eq('id', id)

      if (deleteError) {
        setLists((prev) => {
          const next = [...prev]
          next.splice(index, 0, target)
          return next
        })
        setError(deleteError.message)
      }
    },
    [lists]
  )

  return { lists, loading, error, refresh, createList, updateList, reorderLists, deleteList }
}
