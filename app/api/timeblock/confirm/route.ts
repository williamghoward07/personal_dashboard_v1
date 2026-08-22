import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'
import { MIN_BLOCK_MINUTES } from '@/lib/timeblock/constants'

const MAX_BLOCK_MINUTES = 480

// Called when the user confirms a single proposed block in the auto
// time-blocking wizard (app/components/calendar/timeblock). Writes one
// real Google Calendar event — no linked Supabase row, unlike Routines,
// since nothing in-app currently needs to look up "which events came from
// time-blocking" (see the plan's Phase F for why).
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as {
    title?: string
    start_at?: string
    durationMinutes?: number
    notes?: string | null
  }
  const { title, start_at, durationMinutes, notes } = body

  if (
    !title?.trim() ||
    !start_at ||
    Number.isNaN(new Date(start_at).getTime()) ||
    typeof durationMinutes !== 'number' ||
    durationMinutes < MIN_BLOCK_MINUTES ||
    durationMinutes > MAX_BLOCK_MINUTES
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const startDate = new Date(start_at)
  const date = startDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const time = startDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  })

  try {
    const event = await createGoogleCalendarEvent({
      title: title.trim(),
      date,
      time,
      notes: notes ?? null,
      durationMinutes,
    })

    return NextResponse.json({ id: event.id })
  } catch (err) {
    if (err instanceof GoogleReauthRequiredError) {
      return NextResponse.json(
        { error: 'google_reauth_required', message: 'Reconnect Google Calendar (from the Calendar page) to schedule time blocks.' },
        { status: 409 }
      )
    }
    console.error('Time block confirm failed:', err)
    return NextResponse.json({ error: 'confirm_failed' }, { status: 500 })
  }
}
