'use client'

import { useEffect, useState } from 'react'
import type { SessionWithPrep, TrackedPrep } from '@/lib/timetable/session'
import { useLecturesVersion } from './events'

export type TimetableError = 'not_configured' | 'unauthenticated' | 'failed' | null

export interface UseTimetableResult {
  sessions: SessionWithPrep[]
  /** Google events with prep switched on, by session uid (`gcal:…`). */
  tracked: Map<string, TrackedPrep>
  loading: boolean
  error: TimetableError
  /** The prep tables aren't there yet (migration unapplied): lights are all red. */
  setupNeeded: boolean
}

// Timetable sessions with their traffic lights, from /api/timetable. With a
// range, only sessions overlapping it; without, the whole feed. Refetches
// whenever lecture prep changes anywhere on the page.
export function useTimetable(range?: { timeMin: string; timeMax: string } | null): UseTimetableResult {
  const version = useLecturesVersion()
  const [sessions, setSessions] = useState<SessionWithPrep[]>([])
  const [tracked, setTracked] = useState<Map<string, TrackedPrep>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TimetableError>(null)
  const [setupNeeded, setSetupNeeded] = useState(false)

  const timeMin = range?.timeMin
  const timeMax = range?.timeMax

  useEffect(() => {
    let cancelled = false
    const params = timeMin && timeMax ? `?${new URLSearchParams({ timeMin, timeMax })}` : ''
    fetch(`/api/timetable${params}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(json.error === 'not_configured' || json.error === 'unauthenticated' ? json.error : 'failed')
          setSessions([])
        } else {
          setError(null)
          setSessions((json.sessions ?? []) as SessionWithPrep[])
          setTracked(new Map(((json.tracked ?? []) as TrackedPrep[]).map((t) => [t.uid, t])))
          setSetupNeeded(!!json.setupNeeded)
        }
      })
      .catch(() => {
        if (!cancelled) setError('failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [timeMin, timeMax, version])

  return { sessions, tracked, loading, error, setupNeeded }
}
