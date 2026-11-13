'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/lib/settings/use-settings'
import type { TimetableSession } from '@/lib/timetable/session'
import { useWorkVersion } from './events'
import {
  CONTENT_AI_MATCH_COLUMNS,
  CONTENT_MATCH_COLUMNS,
  buildCourseIndex,
  defaultWeekOneStart,
  matchSession,
  sessionOrdinals,
  type BbContentAiLite,
  type BbContentLite,
  type CourseIndex,
  type SessionMatch,
} from './match'
import type { BbCourseRecord, BbKeyDate, BbSessionOverride } from './types'
import { isMissingSchema } from './use-work-items'

// What Blackboard holds for one lecture: the course for its module code, that
// course's content (no body text), AI classification, this session's
// overrides and the course's key dates, matched by lib/blackboard/match.ts.
// Read-only towards prep: it never reads or writes lecture_sessions.

type CourseLite = Pick<BbCourseRecord, 'id' | 'module_code' | 'name' | 'url' | 'week_offset'>

interface CourseBundle {
  course: CourseLite
  contents: BbContentLite[]
  ai: Map<string, BbContentAiLite>
  keyDates: BbKeyDate[]
  overrides: Pick<BbSessionOverride, 'session_uid' | 'content_id' | 'action'>[]
}

// Per page lifetime, per module code. Refreshed when Blackboard work
// changes (`useWorkVersion`): a confirmed date, an override, a processing pass.
const bundleCache = new Map<string, { version: number; promise: Promise<CourseBundle | null> }>()

async function rows<T>(query: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<T[]> {
  const { data, error } = await query
  if (error) {
    if (isMissingSchema(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []) as T[]
}

async function loadBundle(moduleCode: string): Promise<CourseBundle | null> {
  const courses = await rows<CourseLite>(
    supabase
      .from('bb_courses')
      .select('id, module_code, name, url, week_offset')
      .eq('module_code', moduleCode)
      .is('removed_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(1)
  )
  const course = courses[0]
  if (!course) return null

  const contents = await rows<BbContentLite>(
    supabase.from('bb_content').select(CONTENT_MATCH_COLUMNS).eq('course_id', course.id).is('removed_at', null)
  )
  const contentIds = contents.map((c) => c.id)
  const ai: BbContentAiLite[] = []
  for (let i = 0; i < contentIds.length; i += 100) {
    ai.push(
      ...(await rows<BbContentAiLite>(
        supabase.from('bb_content_ai').select(CONTENT_AI_MATCH_COLUMNS).in('content_id', contentIds.slice(i, i + 100))
      ))
    )
  }
  const [keyDates, overrides] = await Promise.all([
    rows<BbKeyDate>(supabase.from('bb_key_dates').select('*').eq('course_id', course.id).neq('status', 'dismissed')),
    // A handful of rows in all: matchSession keeps only this session's.
    rows<CourseBundle['overrides'][number]>(supabase.from('bb_session_overrides').select('session_uid, content_id, action')),
  ])
  return { course, contents, ai: new Map(ai.map((a) => [a.content_id, a])), keyDates, overrides }
}

function bundleFor(moduleCode: string, version: number): Promise<CourseBundle | null> {
  const cached = bundleCache.get(moduleCode)
  if (cached && cached.version === version) return cached.promise
  const promise = loadBundle(moduleCode)
  // A failed load isn't cached, so the next mount retries.
  promise.catch(() => bundleCache.delete(moduleCode))
  bundleCache.set(moduleCode, { version, promise })
  return promise
}

// The course index (targets, series offsets) once per loaded bundle, week-one
// date and timetable: every session page of the module reuses it.
const indexCache = new WeakMap<CourseBundle, { weekOneStart: string; sessions: TimetableSession[]; index: CourseIndex }>()

function indexFor(bundle: CourseBundle, weekOneStart: string, moduleSessions: TimetableSession[]): CourseIndex {
  const hit = indexCache.get(bundle)
  if (hit && hit.weekOneStart === weekOneStart && hit.sessions === moduleSessions) return hit.index
  const index = buildCourseIndex({
    course: bundle.course,
    contents: bundle.contents,
    ai: bundle.ai,
    overrides: bundle.overrides,
    weekOneStart,
    sessions: moduleSessions,
  })
  indexCache.set(bundle, { weekOneStart, sessions: moduleSessions, index })
  return index
}

// Per timetable array, per module code: the same array each time, so the index cache hits.
const moduleSessionsCache = new WeakMap<TimetableSession[], Map<string, TimetableSession[]>>()

function sessionsOfModule(sessions: TimetableSession[], moduleCode: string): TimetableSession[] {
  let byModule = moduleSessionsCache.get(sessions)
  if (!byModule) {
    byModule = new Map()
    moduleSessionsCache.set(sessions, byModule)
  }
  let list = byModule.get(moduleCode)
  if (!list) {
    list = sessions.filter((s) => s.moduleCode === moduleCode)
    byModule.set(moduleCode, list)
  }
  return list
}

// The whole timetable, once per page: lecture ordinals need every session of
// the module, and week 1 is derived from the first one when not set.
let timetablePromise: Promise<TimetableSession[]> | null = null

function allSessions(): Promise<TimetableSession[]> {
  if (!timetablePromise) {
    timetablePromise = fetch('/api/timetable')
      .then(async (res) => {
        if (!res.ok) throw new Error('Timetable failed to load')
        const json = (await res.json()) as { sessions?: TimetableSession[] }
        return json.sessions ?? []
      })
      .catch((err: unknown) => {
        timetablePromise = null
        throw err
      })
  }
  return timetablePromise
}

export interface UseSessionBlackboardResult {
  /** Null while loading, on error, or when the session's module has no Blackboard course. */
  match: SessionMatch | null
  course: CourseLite | null
  loading: boolean
  error: string | null
}

/**
 * Slides, readings, recordings, other items and key dates Blackboard holds
 * for one timetable session. Sessions with no module code (Google events)
 * or no synced course give `match: null`.
 */
export function useSessionBlackboard(
  session: Pick<TimetableSession, 'uid' | 'moduleCode' | 'start' | 'type'> | null
): UseSessionBlackboardResult {
  const version = useWorkVersion()
  const { settings, loading: settingsLoading } = useSettings()
  const moduleCode = session?.moduleCode ?? null
  const [state, setState] = useState<{
    key: string | null
    bundle: CourseBundle | null
    sessions: TimetableSession[]
    error: string | null
  }>({ key: null, bundle: null, sessions: [], error: null })
  const requestKey = moduleCode ? `${moduleCode}|${version}` : null

  useEffect(() => {
    if (!moduleCode || !requestKey) return
    let cancelled = false
    Promise.all([bundleFor(moduleCode, version), allSessions()])
      .then(([bundle, sessions]) => {
        if (!cancelled) setState({ key: requestKey, bundle, sessions, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ key: requestKey, bundle: null, sessions: [], error: err instanceof Error ? err.message : 'Failed to load Blackboard' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [moduleCode, requestKey, version])

  const ready = !!requestKey && state.key === requestKey && !settingsLoading
  const bundle = ready ? state.bundle : null
  const sessions = ready ? state.sessions : null

  const weekOneStart = useMemo(
    () => settings.week_one_start ?? (sessions ? defaultWeekOneStart(sessions) : null),
    [settings.week_one_start, sessions]
  )
  const ordinals = useMemo(() => (sessions ? sessionOrdinals(sessions) : null), [sessions])
  const moduleSessions = useMemo(
    () => (sessions && moduleCode ? sessionsOfModule(sessions, moduleCode) : null),
    [sessions, moduleCode]
  )
  const index = useMemo(
    () => (bundle && weekOneStart && moduleSessions ? indexFor(bundle, weekOneStart, moduleSessions) : null),
    [bundle, weekOneStart, moduleSessions]
  )
  const uid = session?.uid
  const start = session?.start
  const type = session?.type
  const match = useMemo(() => {
    if (!bundle || !weekOneStart || !index || !uid || !start || !type) return null
    return matchSession(
      { uid, start, type },
      {
        course: bundle.course,
        contents: bundle.contents,
        ai: bundle.ai,
        overrides: bundle.overrides,
        keyDates: bundle.keyDates,
        weekOneStart,
        ordinal: ordinals?.get(uid) ?? null,
        sessions: moduleSessions ?? undefined,
        index,
      }
    )
  }, [bundle, weekOneStart, ordinals, moduleSessions, index, uid, start, type])

  if (!moduleCode) return { match: null, course: null, loading: false, error: null }
  const error = ready ? state.error : null
  return {
    match,
    course: bundle?.course ?? null,
    loading: !ready,
    error: error ?? (ready && bundle && !weekOneStart ? 'No timetable to work out university weeks from' : null),
  }
}
