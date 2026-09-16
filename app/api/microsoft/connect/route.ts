import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NEXT_COOKIE, consentUrl, safeNextPath } from '@/lib/microsoft/oauth'

export const STATE_COOKIE = 'microsoft_oauth_state'

/**
 * Starts the Microsoft consent flow (OneNote + To Do share one connection).
 * `?next=/todos` sends you back there afterwards instead of Education.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const next = safeNextPath(searchParams.get('next'))

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
    return NextResponse.redirect(`${origin}${next}?error=microsoft_not_configured`)
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // must survive the redirect back from Microsoft
    path: '/',
    maxAge: 600,
  }
  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(NEXT_COOKIE, next, cookieOptions)
  return response
}
