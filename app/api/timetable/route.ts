import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTimetable, TimetableNotConfiguredError } from '@/lib/timetable/feed'
import { sessionsInRange } from '@/lib/timetable/ics'
import { countReadingsBySession, countTasksBySession, trackedPrep, withPrep } from '@/lib/timetable/session'

// Timetable sessions in [timeMin, timeMax) (or the whole feed when both are
// omitted), each joined with its prep state: readings (workspace_links with
// a session_uid), tasks and concepts (session_tasks), notes/no-readings
// (lecture_sessions) and the module workspace for its code. `tracked` is the
// same prep for Google events with prep switched on; the calendar joins it
// to the events it already has. Before the migrations are applied those
// queries fail; sessions are still returned, all red.
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

  const [linksRes, statesRes, tasksRes, workspacesRes] = await Promise.all([
    supabase.from('workspace_links').select('session_uid, completed_at').not('session_uid', 'is', null),
    // The whole tables: one user, a row per touched session — and a long
    // `in (uids…)` list would overflow the request URL. `*` so a missing
    // `tracked` column (20261026000000 unapplied) doesn't fail the lookup.
    supabase.from('lecture_sessions').select('*'),
    supabase.from('session_tasks').select('session_uid, phase, done_at'),
    supabase.from('workspaces').select('id, module_code').not('module_code', 'is', null).is('archived_at', null),
  ])

  const failure = linksRes.error ?? statesRes.error ?? tasksRes.error ?? workspacesRes.error
  const setupNeeded = !!failure
  if (failure) {
    console.error(
      '[timetable] prep lookup failed (are 20261019000000 and 20261026000000 applied?):',
      failure.message
    )
  }

  const states = statesRes.data ?? []
  const tasks = countTasksBySession(tasksRes.data ?? [])
  const result = withPrep(sessions, {
    readings: countReadingsBySession(linksRes.data ?? []),
    tasks,
    states: new Map(states.map((row) => [row.uid as string, row])),
    workspaceByCode: new Map(
      (workspacesRes.data ?? []).map((row) => [row.module_code as string, row.id as string])
    ),
  })

  return NextResponse.json({ sessions: result, tracked: trackedPrep(states, tasks), setupNeeded })
}
