'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SessionTask } from '@/lib/types'
import { normalizeUrl } from '@/lib/utils/url'
import { notifyLecturesChanged, useLecturesVersion } from './events'
import { insertSessionTask } from './prep-writes'

export type SessionTaskPatch = Partial<Pick<SessionTask, 'title' | 'url' | 'done_at'>>

export interface SessionTasksApi {
  tasks: SessionTask[]
  loading: boolean
  error: string | null
  addTask: (phase: SessionTask['phase'], input: { title?: string; url?: string | null }) => Promise<SessionTask | null>
  updateTask: (id: string, patch: SessionTaskPatch) => Promise<void>
  removeTask: (id: string) => Promise<void>
}

// The session_tasks of one session (prep tasks and post-session concepts),
// for every place its prep panel is shown. Same optimistic-write and
// notify pattern as useSessionPrep.
export function useSessionTasks(sessionUid: string): SessionTasksApi {
  const version = useLecturesVersion()
  const [tasks, setTasks] = useState<SessionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('session_tasks')
      .select('*')
      .eq('session_uid', sessionUid)
      .order('position')
      .order('created_at')
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        setError(fetchError ? fetchError.message : null)
        setTasks((data ?? []) as SessionTask[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionUid, version])

  const addTask = useCallback<SessionTasksApi['addTask']>(
    async (phase, input) => {
      setError(null)
      try {
        const created = await insertSessionTask(sessionUid, phase, input, tasks.length)
        setTasks((prev) => [...prev, created])
        notifyLecturesChanged()
        return created
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add')
        return null
      }
    },
    [sessionUid, tasks.length]
  )

  const updateTask = useCallback(
    async (id: string, patch: SessionTaskPatch) => {
      let next = patch
      if (patch.url) {
        const url = normalizeUrl(patch.url)
        if (!url) {
          setError('Not a valid URL')
          return
        }
        next = { ...patch, url }
      }
      const before = tasks
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...next } : t)))
      const { error: updateError } = await supabase.from('session_tasks').update(next).eq('id', id)
      if (updateError) {
        setTasks(before)
        setError(updateError.message)
        return
      }
      notifyLecturesChanged()
    },
    [tasks]
  )

  const removeTask = useCallback(
    async (id: string) => {
      const before = tasks
      setTasks((prev) => prev.filter((t) => t.id !== id))
      const { error: deleteError } = await supabase.from('session_tasks').delete().eq('id', id)
      if (deleteError) {
        setTasks(before)
        setError(deleteError.message)
        return
      }
      notifyLecturesChanged()
    },
    [tasks]
  )

  return { tasks, loading, error, addTask, updateTask, removeTask }
}
