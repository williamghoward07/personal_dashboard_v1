import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/crypto'
import {
  GOOGLE_CONTACTS_PROVIDER,
  exchangeCode,
  fetchAccountEmail,
} from '@/lib/google/oauth'
import { STATE_COOKIE } from '../connect/route'

/** Completes the Google Contacts consent flow and stores the sealed token. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/people?error=${reason}`)

  if (searchParams.get('error')) return fail('google_denied')

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return fail('google_no_code')

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
  if (!expected || expected !== state) return fail('google_bad_state')

  try {
    const tokens = await exchangeCode({ code, origin })

    // access_type=offline + prompt=consent should always yield one; without it
    // there is nothing durable to store, so treat it as a failure.
    if (!tokens.refresh_token) return fail('google_no_refresh_token')

    const accountEmail = await fetchAccountEmail(tokens.access_token)

    const { error } = await supabase.from('integrations').upsert(
      {
        provider: GOOGLE_CONTACTS_PROVIDER,
        connected_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: tokens.scope?.split(' ') ?? [],
        encrypted_refresh_token: encryptSecret(tokens.refresh_token),
        account_email: accountEmail,
        // A fresh grant invalidates any previous delta cursor.
        sync_token: null,
        last_error: null,
      },
      { onConflict: 'user_id,provider' },
    )
    if (error) return fail('google_store_failed')
  } catch {
    return fail('google_exchange_failed')
  }

  const response = NextResponse.redirect(`${origin}/people?connected=1`)
  response.cookies.delete(STATE_COOKIE)
  return response
}
