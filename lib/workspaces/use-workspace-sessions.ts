'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { WorkspaceSession } from '@/lib/types'

export interface UseWorkspaceSessionsResult {
  sessionCount: number
  // Previous session's timestamp — the one before the row this mount just
  // logged, so the header reads "last session 2h ago" rather than "just now".
  lastSessionAt: string | null
  loading: boolean
}

// Logs one row per workspace open and reports the totals behind
// "Last session 2h ago" (header) and "18 total sessions" (footer).
export function useWorkspaceSessions(workspaceId: string): UseWorkspaceSessionsResult {
  const [sessions, setSessions] = useState<WorkspaceSession[]>([])
  const [loading, setLoading] = useState(true)
  // React StrictMode double-invokes effects in development; without this
  // guard every open would log two sessions.
  const loggedForWorkspace = useRef<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('workspace_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .then(({ data }) => {
        setSessions((data ?? []) as WorkspaceSession[])
        setLoading(false)
      })
  }, [workspaceId])

  useEffect(() => {
    if (loggedForWorkspace.current === workspaceId) {
      refresh()
      return
    }
    loggedForWorkspace.current = workspaceId

    supabase
      .from('workspace_sessions')
      .insert({ workspace_id: workspaceId })
      .then(({ error }) => {
        // A failed session log is not worth interrupting the page for —
        // it only affects two informational counters.
        if (error) console.error('[workspaces] session log failed:', error.message)
        refresh()
      })
  }, [workspaceId, refresh])

  return {
    sessionCount: sessions.length,
    lastSessionAt: sessions[1]?.started_at ?? null,
    loading,
  }
}
