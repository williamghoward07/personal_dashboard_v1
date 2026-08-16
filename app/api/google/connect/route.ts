import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consentUrl } from '@/lib/google/oauth'

export const STATE_COOKIE = 'google_oauth_state'

/** Starts the Google Contacts consent flow. */
export async function GET(request: Request) {
  const { origin } = new URL(request.url)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  let url: string
  const state = randomBytes(32).toString('base64url')
  try {
    url = consentUrl({ origin, state })
  } catch {
    // Missing client credentials — surface it on the page rather than
    // bouncing the user to a Google error screen.
    return NextResponse.redirect(`${origin}/people?error=google_not_configured`)
  }

  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the redirect back from Google
    path: '/',
    maxAge: 600,
  })
  return response
}
