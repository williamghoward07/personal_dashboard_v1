import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchReminders } from '@/lib/caldav/reminders'

// One-way pull: Reminders is the source of truth for title/notes/due/
// completed on any todo linked by caldav_uid. Todos created directly in
// the app (caldav_uid null) are never touched here — see
// push-completion/route.ts for the one narrow exception to "pull only".
// CalDAV has no push/webhook support, so polling-on-load (triggered from
// /todos) is the mechanism.
//
// A reminder that's disappeared from Reminders since the last pull
// (deleted, or moved out of the configured list) gets its linked todo
// deleted too, so the app doesn't accumulate ghosts the user can only
// clear by hand.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const now = new Date().toISOString()

  let reminders: Awaited<ReturnType<typeof fetchReminders>>
  try {
    reminders = await fetchReminders(now)
  } catch (err) {
    console.error('CalDAV reminders fetch failed:', err)
    const message = err instanceof Error ? err.message : 'caldav_fetch_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const rows = reminders.map((r) => ({
    title: r.title,
    notes: r.notes,
    due_date: r.due_date,
    completed_at: r.completed_at,
    caldav_uid: r.caldav_uid,
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.rpc('upsert_caldav_todos', { rows })
    if (upsertError) {
      console.error('CalDAV todos upsert failed:', upsertError)
      return NextResponse.json({ error: 'upsert_failed' }, { status: 502 })
    }
  }

  const seenUids = new Set(reminders.map((r) => r.caldav_uid))
  const { data: existingLinked } = await supabase.from('todos').select('id, caldav_uid').not('caldav_uid', 'is', null)
  const staleIds = (existingLinked ?? [])
    .filter((t) => t.caldav_uid && !seenUids.has(t.caldav_uid))
    .map((t) => t.id)

  if (staleIds.length > 0) {
    const { error: pruneError } = await supabase.from('todos').delete().in('id', staleIds)
    if (pruneError) {
      // Not fatal to the overall pull — the sync itself succeeded, only
      // cleanup of reminders removed on the Apple side didn't.
      console.error('CalDAV todos prune failed:', pruneError)
    }
  }

  return NextResponse.json({ pulled: rows.length, removed: staleIds.length })
}
