'use client'

import { createClient } from '@/lib/supabase/client'
import { GOOGLE_CALENDAR_SCOPE } from './calendar-scope'

// Both queryParams below are required — without access_type=offline and
// prompt=consent, Google will not return a provider_refresh_token, and
// lib/google/token.ts has no way to mint fresh access tokens after the
// first one expires. Shared between the login page and the day view's
// "Reconnect Google Calendar" state so the two can't drift out of sync.
export async function connectGoogleCalendar(next = '/') {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: GOOGLE_CALENDAR_SCOPE,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
}
