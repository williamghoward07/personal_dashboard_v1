'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTimetable, type TimetableError } from '@/lib/lectures/use-timetable'
import { useWorkVersion } from './events'
import type { BbCourseRecord, BbKeyDate } from './types'
import { toWorkItems, type WorkInput, type WorkItem } from './work'

/**
 * A missing table or column (migration not applied, schema cache behind):
 * the dashboard shows "no Blackboard data" instead of an error.
 */
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code && ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error.code)) return true
  return /does not exist|schema cache/i.test(error.message ?? '')
}

type Result<T> = { data: T[] | null; error: { code?: string; message: string } | null }

/** Rows, or none when the table is missing; a real failure is reported in `failures`. */
function rowsOf<T>(res: Result<T>, failures: string[]): T[] {
  if (res.error) {
    if (!isMissingSchema(res.error)) failures.push(res.error.message)
    return []
  }
  return res.data ?? []
}

/** `select … where id in (…)`, in chunks so the request URL stays short. */
async function selectByIds<T>(table: string, columns: string, ids: string[]): Promise<Result<T>> {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const res = await supabase.from(table).select(columns).in('id', ids.slice(i, i + 100))
    if (res.error) return { data: null, error: res.error }
    rows.push(...((res.data ?? []) as T[]))
  }
  return { data: rows, error: null }
}

const COURSE_COLUMNS = 'id, module_code, name, url'
const ASSIGNMENT_COLUMNS = 'id, course_id, title, due_at, status, is_formative, url, done_at, removed_at'
const KEY_DATE_COLUMNS =
  'id, course_id, announcement_id, content_id, document_id, title, category, due_on, due_at, quote, status, assignment_id, done_at'

interface BbData {
  courses: WorkInput['courses']
  assignments: WorkInput['assignments']
  keyDates: WorkInput['keyDates']
  contentUrlById: Map<string, string | null>
  announcementUrlById: Map<string, string | null>
  documentContentId: Map<string, string>
}

const EMPTY: BbData = {
  courses: [],
  assignments: [],
  keyDates: [],
  contentUrlById: new Map(),
  announcementUrlById: new Map(),
  documentContentId: new Map(),
}

async function loadBlackboard(): Promise<{ data: BbData; failures: string[] }> {
  const failures: string[] = []
  const [coursesRes, assignmentsRes, keyDatesRes] = await Promise.all([
    supabase.from('bb_courses').select(COURSE_COLUMNS),
    supabase.from('bb_assignments').select(ASSIGNMENT_COLUMNS).is('removed_at', null),
    supabase.from('bb_key_dates').select(KEY_DATE_COLUMNS).in('status', ['suggested', 'confirmed']),
  ])
  const courses = rowsOf(coursesRes as Result<Pick<BbCourseRecord, 'id' | 'module_code' | 'name' | 'url'>>, failures)
  const assignments = rowsOf(assignmentsRes as Result<WorkInput['assignments'][number]>, failures)
  const keyDates = rowsOf(keyDatesRes as Result<WorkInput['keyDates'][number]>, failures)

  // Source links for the key dates only.
  const ids = (pick: (kd: Pick<BbKeyDate, 'content_id' | 'document_id' | 'announcement_id'>) => string | null) => [
    ...new Set(keyDates.map(pick).filter((id): id is string => !!id)),
  ]
  const documentIds = ids((kd) => kd.document_id)
  const announcementIds = ids((kd) => kd.announcement_id)
  const documents = rowsOf(
    await selectByIds<{ id: string; content_id: string }>('bb_documents', 'id, content_id', documentIds),
    failures
  )
  const contentIds = [...new Set([...ids((kd) => kd.content_id), ...documents.map((d) => d.content_id)])]
  const [contentRes, announcementRes] = await Promise.all([
    selectByIds<{ id: string; url: string | null }>('bb_content', 'id, url', contentIds),
    selectByIds<{ id: string; url: string | null }>('bb_announcements', 'id, url', announcementIds),
  ])
  const content = rowsOf(contentRes, failures)
  const announcements = rowsOf(announcementRes, failures)

  return {
    data: {
      courses,
      assignments,
      keyDates,
      contentUrlById: new Map(content.map((c) => [c.id, c.url])),
      announcementUrlById: new Map(announcements.map((a) => [a.id, a.url])),
      documentContentId: new Map(documents.map((d) => [d.id, d.content_id])),
    },
    failures,
  }
}

const DAY_MS = 86_400_000

export interface UseWorkItemsResult {
  items: WorkItem[]
  loading: boolean
  /** A Blackboard read that failed for a reason other than a missing table. */
  error: string | null
  /** The timetable's own error; Blackboard items still load without it. */
  timetableError: TimetableError
  refresh: () => void
}

/**
 * Every work item: official assignments, AI key dates (not dismissed),
 * timetable tests and lecture prep (60 days back to 300 days ahead).
 * Refetches when Blackboard work or lecture prep changes on the page. With
 * no Blackboard tables or data it's just the timetable's items.
 */
export function useWorkItems(): UseWorkItemsResult {
  const workVersion = useWorkVersion()
  const [range] = useState(() => {
    const t = Date.now()
    return { timeMin: new Date(t - 60 * DAY_MS).toISOString(), timeMax: new Date(t + 300 * DAY_MS).toISOString() }
  })
  // useTimetable refetches on its own when lecture prep changes.
  const timetable = useTimetable(range)
  const [bb, setBb] = useState<BbData>(EMPTY)
  const [bbLoading, setBbLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadBlackboard()
      .then(({ data, failures }) => {
        if (cancelled) return
        setBb(data)
        setError(failures.length ? failures[0] : null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Blackboard work')
      })
      .finally(() => {
        if (!cancelled) setBbLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workVersion, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const items = useMemo(
    () => toWorkItems({ ...bb, sessions: timetable.sessions, now: new Date() }),
    [bb, timetable.sessions]
  )

  return { items, loading: bbLoading || timetable.loading, error, timetableError: timetable.error, refresh }
}
