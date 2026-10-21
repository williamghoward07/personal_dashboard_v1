import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTimetable, TimetableNotConfiguredError } from '@/lib/timetable/feed'
import { sessionsInRange } from '@/lib/timetable/ics'
import { countReadingsBySession, withPrep } from '@/lib/timetable/session'

// Timetable sessions in [timeMin, timeMax) (or the whole feed when both are
// omitted), each joined with its prep state: readings (workspace_links with
// a session_uid), notes/no-readings (lecture_sessions) and the module
// workspace for its code. Before 20261019000000 is applied those queries
// fail; sessions are still returned, all red.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const timeMin = request.nextUrl.searchParams.get('timeMin')
  const timeMax = request.nextUrl.searchParams.get('timeMax')

  let all
  try {
    all = await fetchTimetable()
  } catch (err) {
    if (err instanceof TimetableNotConfiguredError) {
      return NextResponse.json({ error: 'not_configured' }, { status: 409 })
    }
    console.error('[timetable] fetch failed:', err)
    return NextResponse.json({ error: 'timetable_fetch_failed' }, { status: 502 })
  }

  const sessions = timeMin && timeMax ? sessionsInRange(all, timeMin, timeMax) : all

  const [linksRes, statesRes, workspacesRes] = await Promise.all([
    supabase.from('workspace_links').select('session_uid, completed_at').not('session_uid', 'is', null),
    // The whole table: one user, a row per touched session — and a long
    // `in (uids…)` list would overflow the request URL.
    supabase.from('lecture_sessions').select('uid, no_readings, notes_done_at, note'),
    supabase.from('workspaces').select('id, module_code').not('module_code', 'is', null).is('archived_at', null),
  ])

  const setupNeeded = !!(linksRes.error || statesRes.error || workspacesRes.error)
  if (setupNeeded) {
    console.error(
      '[timetable] prep lookup failed (is 20261019000000_lecture_sessions.sql applied?):',
      linksRes.error?.message ?? statesRes.error?.message ?? workspacesRes.error?.message
    )
  }

  const result = withPrep(sessions, {
    readings: countReadingsBySession(linksRes.data ?? []),
    states: new Map((statesRes.data ?? []).map((row) => [row.uid as string, row])),
    workspaceByCode: new Map(
      (workspacesRes.data ?? []).map((row) => [row.module_code as string, row.id as string])
    ),
  })

  return NextResponse.json({ sessions: result, setupNeeded })
}
