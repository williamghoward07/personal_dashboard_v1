import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTodayGoogleCalendarEvents } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const events = await fetchTodayGoogleCalendarEvents()
    return NextResponse.json({ events })
  } catch (err) {
    if (err instanceof GoogleReauthRequiredError) {
      return NextResponse.json({ error: 'reconnect_required' }, { status: 409 })
    }
    return NextResponse.json({ error: 'calendar_fetch_failed' }, { status: 502 })
  }
}
