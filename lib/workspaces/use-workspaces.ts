'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Workspace } from '@/lib/types'

export interface UseWorkspacesResult {
  workspaces: Workspace[]
  loading: boolean
  error: string | null
  refresh: () => void
  createWorkspace: (title: string) => Promise<Workspace | null>
  updateWorkspace: (id: string, patch: Partial<Pick<Workspace, 'title' | 'subtitle'>>) => Promise<void>
  archiveWorkspace: (id: string) => Promise<void>
  unarchiveWorkspace: (id: string) => Promise<void>
}

// Loads every workspace (active + archived) — the list page and detail
// page both filter/find client-side, matching this app's dominant
// load-broad-filter-narrow convention (e.g. AccountDetailBoard finding
// one account out of useAccounts()'s full list).
export function useWorkspaces(): UseWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setError(null)
          setWorkspaces((data ?? []) as Workspace[])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createWorkspace = useCallback(async (title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return null

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticWorkspace: Workspace = {
      id: optimisticId,
      title: trimmed,
      subtitle: null,
      archived_at: null,
      created_at: new Date().toISOString(),
    }
    setWorkspaces((prev) => [optimisticWorkspace, ...prev])
    setError(null)

    const { data, error: insertError } = await supabase
      .from('workspaces')
      .insert({ title: trimmed })
      .select()
      .single()

    if (insertError || !data) {
      setWorkspaces((prev) => prev.filter((w) => w.id !== optimisticId))
      setError(insertError?.message ?? 'Failed to create workspace')
      return null
    }

    const created = data as Workspace
    setWorkspaces((prev) => prev.map((w) => (w.id === optimisticId ? created : w)))
    return created
  }, [])

  const updateWorkspace = useCallback(
    async (id: string, patch: Partial<Pick<Workspace, 'title' | 'subtitle'>>) => {
      const target = workspaces.find((w) => w.id === id)
      if (!target) return

      setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
      setError(null)

      const { error: updateError } = await supabase.from('workspaces').update(patch).eq('id', id)

      if (updateError) {
        setWorkspaces((prev) => prev.map((w) => (w.id === id ? target : w)))
        setError(updateError.message)
      }
    },
    [workspaces]
  )

  const setArchivedAt = useCallback(
    async (id: string, archivedAt: string | null) => {
      const target = workspaces.find((w) => w.id === id)
      if (!target) return

      setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, archived_at: archivedAt } : w)))
      setError(null)

      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ archived_at: archivedAt })
        .eq('id', id)

      if (updateError) {
        setWorkspaces((prev) => prev.map((w) => (w.id === id ? target : w)))
        setError(updateError.message)
      }
    },
    [workspaces]
  )

  const archiveWorkspace = useCallback((id: string) => setArchivedAt(id, new Date().toISOString()), [setArchivedAt])
  const unarchiveWorkspace = useCallback((id: string) => setArchivedAt(id, null), [setArchivedAt])

  return {
    workspaces,
    loading,
    error,
    refresh,
    createWorkspace,
    updateWorkspace,
    archiveWorkspace,
    unarchiveWorkspace,
  }
}
