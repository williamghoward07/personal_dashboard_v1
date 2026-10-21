'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { londonWeekBoundsUTC } from '@/lib/google/london-day'
import { studyProgressByWorkspace, type StudyProgress } from './study-progress'

// Readings progress + this week's study minutes for every workspace, in two
// small column reads. Fails quietly (empty map) if the readings/time
// migration hasn't been applied yet.
export function useStudyProgress(): Map<string, StudyProgress> {
  const [progress, setProgress] = useState<Map<string, StudyProgress>>(new Map())

  useEffect(() => {
    let cancelled = false
    const week = londonWeekBoundsUTC()
    Promise.all([
      supabase.from('workspace_links').select('workspace_id, completed_at').not('week', 'is', null),
      supabase
        .from('workspace_time_logs')
        .select('workspace_id, minutes')
        .gte('day', week.startDateKey)
        .lt('day', week.endDateKey),
    ]).then(([readings, logs]) => {
      if (cancelled) return
      setProgress(studyProgressByWorkspace(readings.data ?? [], logs.data ?? []))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return progress
}
