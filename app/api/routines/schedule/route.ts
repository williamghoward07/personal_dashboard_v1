import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'
import type { RoutineItem } from '@/lib/types'

// Called when a routine template is dragged onto a specific day/time in the
// Calendar page's Routines tab (RoutinesPanel). Creates one real Google
// Calendar event spanning the routine's total step duration, then records a
// routine_instances row linking to it — the app's own source of truth for
// rendering the block and for looking up its step breakdown later, since
// Google events can't hold real sub-events.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { routine_id?: string; start_at?: string }
  const { routine_id, start_at } = body

  if (!routine_id || !start_at) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .select('id, name, colour')
    .eq('id', routine_id)
    .single()

  if (routineError || !routine) {
    return NextResponse.json({ error: 'routine_not_found' }, { status: 404 })
  }

  const { data: items, error: itemsError } = await supabase
    .from('routine_items')
    .select('*')
    .eq('routine_id', routine_id)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: 'items_fetch_failed' }, { status: 500 })
  }

  const routineItems = (items ?? []) as RoutineItem[]
  if (routineItems.length === 0) {
    return NextResponse.json({ error: 'routine_has_no_steps' }, { status: 400 })
  }

  const totalDuration = routineItems.reduce((sum, item) => sum + item.duration_minutes, 0)

  const startDate = new Date(start_at)
  const date = startDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }) // YYYY-MM-DD
  const time = startDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  })

  const notes = routineItems
    .map((item, i) => `${i + 1}. ${item.name} (${item.duration_minutes}m)${item.description ? ` — ${item.description}` : ''}`)
    .join('\n')

  try {
    const event = await createGoogleCalendarEvent({
      title: routine.name,
      date,
      time,
      notes,
      durationMinutes: totalDuration,
    })

    const { data: instance, error: insertError } = await supabase
      .from('routine_instances')
      .insert({
        routine_id: routine.id,
        routine_name: routine.name,
        routine_colour: routine.colour,
        start_at,
        duration_minutes: totalDuration,
        google_event_id: event.id,
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'instance_insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ instance })
  } catch (err) {
    if (err instanceof GoogleReauthRequiredError) {
      return NextResponse.json(
        { error: 'google_reauth_required', message: 'Reconnect Google Calendar (from the Calendar page) to schedule routines.' },
        { status: 409 }
      )
    }
    console.error('Routine schedule failed:', err)
    return NextResponse.json({ error: 'schedule_failed' }, { status: 500 })
  }
}
