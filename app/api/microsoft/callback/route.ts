import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/crypto'
import {
  MICROSOFT_ONENOTE_PROVIDER,
  exchangeCode,
  fetchAccountDisplay,
} from '@/lib/microsoft/oauth'
import { STATE_COOKIE } from '../connect/route'

/** Completes the Microsoft OneNote consent flow and stores the sealed token. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/education?error=${reason}`)

  if (searchParams.get('error')) return fail('microsoft_denied')

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return fail('microsoft_no_code')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  // CSRF: the state we handed out must come back unchanged.
  const cookieHeader = request.headers.get('cookie') ?? ''
  const expected = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1)
  if (!expected || expected !== state) return fail('microsoft_bad_state')

  try {
    const tokens = await exchangeCode({ code, origin })

    // offline_access should always yield one; without it there is nothing
    // durable to store, so treat it as a failure.
    if (!tokens.refresh_token) return fail('microsoft_no_refresh_token')

    const accountEmail = await fetchAccountDisplay(tokens.access_token)

    const { error } = await supabase.from('integrations').upsert(
      {
        provider: MICROSOFT_ONENOTE_PROVIDER,
        connected_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: tokens.scope?.split(' ') ?? [],
        encrypted_refresh_token: encryptSecret(tokens.refresh_token),
        account_email: accountEmail,
        sync_token: null,
        last_error: null,
      },
      { onConflict: 'user_id,provider' },
    )
    if (error) return fail('microsoft_store_failed')
  } catch {
    return fail('microsoft_exchange_failed')
  }

  const response = NextResponse.redirect(`${origin}/education?connected=1`)
  response.cookies.delete(STATE_COOKIE)
  return response
}
