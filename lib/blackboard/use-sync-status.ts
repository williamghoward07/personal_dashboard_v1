'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkVersion } from './events'
import { syncStatus, type SyncRun, type SyncStatus } from './work'

export type { SyncRun, SyncState, SyncStatus } from './work'

export interface UseSyncStatusResult extends SyncStatus {
  loading: boolean
  refresh: () => void
}

/** The Blackboard sync state for the dashboard chip, from the latest bb_sync_runs rows. */
export function useSyncStatus(): UseSyncStatusResult {
  const version = useWorkVersion()
  const [runs, setRuns] = useState<SyncRun[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('bb_sync_runs')
      .select('id, started_at, finished_at, trigger, ok, counts, error')
      .order('finished_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return
        // A missing table (or any other read failure) reads as "never synced".
        setRuns(error ? [] : ((data ?? []) as SyncRun[]))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [version, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { ...syncStatus(runs, new Date()), loading, refresh }
}
