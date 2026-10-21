'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LectureSession, WorkspaceLink } from '@/lib/types'
import type { TimetableSession } from '@/lib/timetable/session'
import { notifyLecturesChanged, useLecturesVersion } from './events'
import { ensureModuleWorkspace, insertSessionReading, saveSessionState, type SessionStatePatch } from './prep-writes'

export interface SessionPrepApi {
  readings: WorkspaceLink[]
  state: LectureSession | null
  loading: boolean
  error: string | null
  addReading: (rawUrl: string) => Promise<WorkspaceLink | null>
  toggleReading: (link: WorkspaceLink) => Promise<void>
  removeReading: (id: string) => Promise<void>
  renameReading: (id: string, title: string) => Promise<void>
  saveState: (patch: SessionStatePatch) => Promise<void>
}

// Prep for one session, outside a workspace page (the calendar popover and
// /lectures). Readings are found by session_uid in any workspace; adding
// the first one creates the module workspace if needed. Inside a module
// workspace, LecturesSection drives the same panel from that page's own
// link state instead, so the two never disagree on screen.
export function useSessionPrep(
  session: Pick<TimetableSession, 'uid' | 'moduleCode' | 'moduleName' | 'title' | 'start'>
): SessionPrepApi {
  const version = useLecturesVersion()
  const [readings, setReadings] = useState<WorkspaceLink[]>([])
  const [state, setState] = useState<LectureSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('workspace_links').select('*').eq('session_uid', session.uid).order('position'),
      supabase.from('lecture_sessions').select('*').eq('uid', session.uid).maybeSingle(),
    ]).then(([linksRes, stateRes]) => {
      if (cancelled) return
      const failure = linksRes.error ?? stateRes.error
      setError(failure ? failure.message : null)
      setReadings((linksRes.data ?? []) as WorkspaceLink[])
      setState((stateRes.data ?? null) as LectureSession | null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [session.uid, version])

  const addReading = useCallback(
    async (rawUrl: string) => {
      setError(null)
      try {
        const workspaceId =
          readings[0]?.workspace_id ??
          (session.moduleCode ? await ensureModuleWorkspace(session.moduleCode, session.moduleName) : null)
        if (!workspaceId) throw new Error('This session has no module code, so there is no workspace to file it in')
        const created = await insertSessionReading(workspaceId, session.uid, rawUrl, readings.length)
        setReadings((prev) => [...prev, created])
        notifyLecturesChanged()
        return created
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add reading')
        return null
      }
    },
    [readings, session]
  )

  const patchLink = useCallback(
    async (id: string, patch: Partial<WorkspaceLink>) => {
      const before = readings
      setReadings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      const { error: updateError } = await supabase.from('workspace_links').update(patch).eq('id', id)
      if (updateError) {
        setReadings(before)
        setError(updateError.message)
        return
      }
      notifyLecturesChanged()
    },
    [readings]
  )

  const toggleReading = useCallback(
    (link: WorkspaceLink) => patchLink(link.id, { completed_at: link.completed_at ? null : new Date().toISOString() }),
    [patchLink]
  )

  const renameReading = useCallback((id: string, title: string) => patchLink(id, { title }), [patchLink])

  const removeReading = useCallback(
    async (id: string) => {
      const before = readings
      setReadings((prev) => prev.filter((l) => l.id !== id))
      const { error: deleteError } = await supabase.from('workspace_links').delete().eq('id', id)
      if (deleteError) {
        setReadings(before)
        setError(deleteError.message)
        return
      }
      notifyLecturesChanged()
    },
    [readings]
  )

  const saveState = useCallback(
    async (patch: SessionStatePatch) => {
      const before = state
      setState((prev) => (prev ? { ...prev, ...patch } : prev))
      try {
        setState(await saveSessionState(session, patch))
        notifyLecturesChanged()
      } catch (err) {
        setState(before)
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    },
    [session, state]
  )

  return { readings, state, loading, error, addReading, toggleReading, removeReading, renameReading, saveState }
}
