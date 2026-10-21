'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceTimeLog } from '@/lib/types'

export type TimeLogInput = Pick<WorkspaceTimeLog, 'day' | 'minutes' | 'note'>

export interface UseWorkspaceTimeResult {
  logs: WorkspaceTimeLog[]
  loading: boolean
  error: string | null
  addLog: (input: TimeLogInput) => Promise<boolean>
  updateLog: (id: string, patch: Partial<TimeLogInput>) => Promise<void>
  removeLog: (id: string) => Promise<void>
}

// Study-time entries for one workspace (workspace_time_logs). Writes are
// optimistic and roll back on failure, like the other workspace hooks.
export function useWorkspaceTime(workspaceId: string): UseWorkspaceTimeResult {
  const [logs, setLogs] = useState<WorkspaceTimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('workspace_time_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('day', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) setError(fetchError.message)
        else setLogs((data ?? []) as WorkspaceTimeLog[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const addLog = useCallback(
    async (input: TimeLogInput) => {
      const optimisticId = `optimistic-${crypto.randomUUID()}`
      const optimistic: WorkspaceTimeLog = {
        id: optimisticId,
        workspace_id: workspaceId,
        ...input,
        created_at: new Date().toISOString(),
      }
      setLogs((prev) => [optimistic, ...prev])
      setError(null)

      const { data, error: insertError } = await supabase
        .from('workspace_time_logs')
        .insert({ workspace_id: workspaceId, ...input })
        .select()
        .single()

      if (insertError || !data) {
        setLogs((prev) => prev.filter((l) => l.id !== optimisticId))
        setError(insertError?.message ?? 'Failed to log time')
        return false
      }
      setLogs((prev) => prev.map((l) => (l.id === optimisticId ? (data as WorkspaceTimeLog) : l)))
      return true
    },
    [workspaceId]
  )

  const updateLog = useCallback(
    async (id: string, patch: Partial<TimeLogInput>) => {
      const target = logs.find((l) => l.id === id)
      if (!target) return
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      setError(null)
      const { error: updateError } = await supabase.from('workspace_time_logs').update(patch).eq('id', id)
      if (updateError) {
        setLogs((prev) => prev.map((l) => (l.id === id ? target : l)))
        setError(updateError.message)
      }
    },
    [logs]
  )

  const removeLog = useCallback(
    async (id: string) => {
      const target = logs.find((l) => l.id === id)
      if (!target) return
      setLogs((prev) => prev.filter((l) => l.id !== id))
      setError(null)
      const { error: deleteError } = await supabase.from('workspace_time_logs').delete().eq('id', id)
      if (deleteError) {
        setLogs((prev) => [target, ...prev])
        setError(deleteError.message)
      }
    },
    [logs]
  )

  return { logs, loading, error, addLog, updateLog, removeLog }
}
