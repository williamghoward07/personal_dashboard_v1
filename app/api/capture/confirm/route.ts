import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'
import type { ActDraft, ActEntity } from '@/lib/search/act-types'

const ENTITIES: ActEntity[] = ['todo', 'education_task', 'calendar_event']

// Only ever called after the user clicks Confirm (or Confirm all) on a
// draft from app/api/brain-dump/extract — the home query box's Capture
// mode and the Brain Dump page — never a direct consequence of typing.
// Writes one todo, education task or Google Calendar event.
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

  if (!draft || !ENTITIES.includes(draft.entity) || !draft.title?.trim()) {
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
      console.error('Capture confirm: calendar event creation failed:', err)
      return NextResponse.json({ error: 'insert_failed', message: "Couldn't create the calendar event." }, { status: 500 })
    }
  }

  // Known gap: the Education pages read `tasks` (per module), not
  // `education_tasks` — a captured education task counts on Daily Goals
  // but doesn't show in Education until the two tables are reconciled.
  const table = draft.entity === 'todo' ? 'todos' : 'education_tasks'
  const row: Record<string, unknown> = { title: draft.title.trim(), due_date: draft.due_date, notes: draft.notes }
  // due_time only exists on the todos table — education_tasks has no
  // equivalent column.
  if (draft.entity === 'todo') row.due_time = draft.due_time

  const { data, error } = await supabase.from(table).insert(row).select('id').single()

  if (error) {
    console.error(`Capture confirm: insert into ${table} failed:`, error)
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
