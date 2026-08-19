import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'
import type { ActDraft } from '@/lib/search/act'

// Only ever called after the user clicks Confirm on a draft shown by
// app/api/search/act — never a direct consequence of typing. This is the
// one place in Search mode 3 that actually writes a row.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { draft?: ActDraft }
  const draft = body.draft

  if (!draft || !draft.title?.trim()) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (draft.entity === 'calendar_event') {
    if (!draft.due_date) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'A calendar event needs a date.' },
        { status: 400 }
      )
    }

    try {
      const event = await createGoogleCalendarEvent({
        title: draft.title.trim(),
        date: draft.due_date,
        time: draft.due_time,
        notes: draft.notes,
      })
      return NextResponse.json({ success: true, id: event.id })
    } catch (err) {
      if (err instanceof GoogleReauthRequiredError) {
        return NextResponse.json(
          { error: 'google_reauth_required', message: 'Reconnect Google Calendar (from the Calendar page) to create events.' },
          { status: 409 }
        )
      }
      console.error('Search act confirm calendar event creation failed:', err)
      return NextResponse.json({ error: 'insert_failed', message: "Couldn't create the calendar event." }, { status: 500 })
    }
  }

  const table = draft.entity === 'todo' ? 'todos' : 'education_tasks'
  const { data, error } = await supabase
    .from(table)
    .insert({ title: draft.title.trim(), due_date: draft.due_date, notes: draft.notes })
    .select('id')
    .single()

  if (error) {
    console.error(`Search act confirm insert into ${table} failed:`, error)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
