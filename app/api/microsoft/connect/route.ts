import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consentUrl } from '@/lib/microsoft/oauth'

export const STATE_COOKIE = 'microsoft_oauth_state'

/** Starts the Microsoft OneNote consent flow. */
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
    // bouncing the user to a Microsoft error screen.
    return NextResponse.redirect(`${origin}/education?error=microsoft_not_configured`)
  }

  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the redirect back from Microsoft
    path: '/',
    maxAge: 600,
  })
  return response
}
