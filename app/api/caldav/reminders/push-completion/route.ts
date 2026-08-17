import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushCompletion } from '@/lib/caldav/reminders'

interface RequestBody {
  caldav_uid?: string
  completed?: boolean
}

// The one exception to this feature's otherwise pure pull-only design:
// completing (or un-completing) a CalDAV-linked todo in the app also
// flips STATUS/COMPLETED on the matching VTODO in Reminders, so ticking
// something off here doesn't leave it permanently open there. Title/
// due-date edits are never pushed — those stay something you do in
// Reminders/via Siri, flowing back into the app on the next pull.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as RequestBody
  const { caldav_uid, completed } = body

  if (!caldav_uid || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // Re-validates ownership via RLS rather than trusting the client's
  // word that this uid is theirs — matches how every other write route
  // in this app re-derives/re-checks server-side instead of taking a
  // client-supplied identity at face value.
  const { data: todo } = await supabase.from('todos').select('id').eq('caldav_uid', caldav_uid).maybeSingle()
  if (!todo) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  try {
    await pushCompletion(caldav_uid, completed, new Date().toISOString())
  } catch (err) {
    console.error('CalDAV completion push failed:', err)
    const message = err instanceof Error ? err.message : 'push_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
