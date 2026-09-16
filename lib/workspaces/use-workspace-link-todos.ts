'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceLinkTodo } from '@/lib/types'

export interface UseWorkspaceLinkTodosResult {
  linkTodos: WorkspaceLinkTodo[]
  loading: boolean
  error: string | null
  refresh: () => void
  attachTodosToLink: (workspaceLinkId: string, todoIds: string[]) => Promise<void>
  attachLinksToTodo: (todoId: string, workspaceLinkIds: string[]) => Promise<void>
  detach: (junctionRowId: string) => Promise<void>
}

// The many-to-many link<->todo attachment, independent of a todo's
// overall workspace_id. Loads all of the user's rows unfiltered (RLS
// already scopes by user; trivial row count for a single-user app) —
// matches this codebase's load-broad-filter-narrow convention rather than
// inventing an embedded-resource join filter. One shared instance per
// workspace detail page, passed down to both the links and todos sections.
export function useWorkspaceLinkTodos(): UseWorkspaceLinkTodosResult {
  const [linkTodos, setLinkTodos] = useState<WorkspaceLinkTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('workspace_link_todos')
      .select('*')
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setLinkTodos((data ?? []) as WorkspaceLinkTodo[])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Non-optimistic bulk attach, mirroring ResearchAttachModal.attach: await
  // the insert, append the returned real rows on success, otherwise just
  // surface an error — no local state to roll back beforehand.
  const attachTodosToLink = useCallback(async (workspaceLinkId: string, todoIds: string[]) => {
    if (todoIds.length === 0) return
    setError(null)

    const rows = todoIds.map((todo_id) => ({ workspace_link_id: workspaceLinkId, todo_id }))
    const { data, error: insertError } = await supabase.from('workspace_link_todos').insert(rows).select()

    if (insertError) {
      setError(insertError.message)
      return
    }

    setLinkTodos((prev) => [...prev, ...((data ?? []) as WorkspaceLinkTodo[])])
  }, [])

  const attachLinksToTodo = useCallback(async (todoId: string, workspaceLinkIds: string[]) => {
    if (workspaceLinkIds.length === 0) return
    setError(null)

    const rows = workspaceLinkIds.map((workspace_link_id) => ({ workspace_link_id, todo_id: todoId }))
    const { data, error: insertError } = await supabase.from('workspace_link_todos').insert(rows).select()

    if (insertError) {
      setError(insertError.message)
      return
    }

    setLinkTodos((prev) => [...prev, ...((data ?? []) as WorkspaceLinkTodo[])])
  }, [])

  const detach = useCallback(
    async (junctionRowId: string) => {
      const index = linkTodos.findIndex((lt) => lt.id === junctionRowId)
      if (index === -1) return
      const target = linkTodos[index]

      setLinkTodos((prev) => prev.filter((lt) => lt.id !== junctionRowId))
      setError(null)

      const { error: deleteError } = await supabase.from('workspace_link_todos').delete().eq('id', junctionRowId)

      if (deleteError) {
        setLinkTodos((prev) => {
          const next = [...prev]
          next.splice(index, 0, target)
          return next
        })
        setError(deleteError.message)
      }
    },
    [linkTodos]
  )

  return { linkTodos, loading, error, refresh, attachTodosToLink, attachLinksToTodo, detach }
}
