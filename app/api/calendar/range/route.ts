import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchGoogleCalendarEvents } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'

// Backs the /calendar page's month/week/day views — one Calendar API call
// per requested range, timeMin/timeMax computed client-side via
// lib/google/london-day.ts so day boundaries stay Europe/London-correct.
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

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: 'timeMin and timeMax are required' }, { status: 400 })
  }

  try {
    const events = await fetchGoogleCalendarEvents(timeMin, timeMax)
    return NextResponse.json({ events })
  } catch (err) {
    if (err instanceof GoogleReauthRequiredError) {
      return NextResponse.json({ error: 'reconnect_required' }, { status: 409 })
    }
    return NextResponse.json({ error: 'calendar_fetch_failed' }, { status: 502 })
  }
}
