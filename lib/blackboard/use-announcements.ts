'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkVersion } from './events'
import {
  ANNOUNCEMENT_COLUMNS,
  forModule,
  toAnnouncementViews,
  unreadCount,
  type AnnouncementCourse,
  type AnnouncementRow,
  type AnnouncementView,
} from './announcements'
import { isMissingSchema } from './use-work-items'

export interface UseAnnouncementsResult {
  /** Newest first. Of one module when a code was given, else of every course. */
  announcements: AnnouncementView[]
  unread: number
  loading: boolean
  error: string | null
  /** Sets `read_at` (dashboard-owned; a sync never touches it). Already read is a no-op. */
  markRead: (id: string) => Promise<void>
}

/**
 * Blackboard announcements, read-only except for `read_at`. A missing table
 * (migration not applied) reads as none. Refetches when Blackboard work changes.
 */
export function useAnnouncements(moduleCode?: string | null): UseAnnouncementsResult {
  const version = useWorkVersion()
  const [all, setAll] = useState<AnnouncementView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [coursesRes, rowsRes] = await Promise.all([
        supabase.from('bb_courses').select('id, module_code, name').is('removed_at', null),
        supabase.from('bb_announcements').select(ANNOUNCEMENT_COLUMNS).is('removed_at', null),
      ])
      if (cancelled) return
      const failure = [coursesRes.error, rowsRes.error].find((e) => e && !isMissingSchema(e))
      if (failure) {
        setError(failure.message)
        setAll([])
      } else {
        setError(null)
        setAll(
          toAnnouncementViews(
            (rowsRes.data ?? []) as AnnouncementRow[],
            (coursesRes.data ?? []) as AnnouncementCourse[]
          )
        )
      }
      setLoading(false)
    })().catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load announcements')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [version])

  const announcements = useMemo(() => (moduleCode ? forModule(all, moduleCode) : all), [all, moduleCode])

  const markRead = useCallback(
    async (id: string) => {
      if (all.find((a) => a.id === id)?.read !== false) return
      setAll((list) => list.map((a) => (a.id === id ? { ...a, read: true } : a)))
      const { error: writeError } = await supabase
        .from('bb_announcements')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      if (writeError) {
        // Put it back: it isn't saved as read.
        setAll((list) => list.map((a) => (a.id === id ? { ...a, read: false } : a)))
        setError(writeError.message)
      }
    },
    [all]
  )

  return { announcements, unread: unreadCount(announcements), loading, error, markRead }
}
