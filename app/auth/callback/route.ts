import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { googleVaultSecretName, upsertGoogleVaultTokens } from '@/lib/google/vault'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      await storeGoogleCalendarTokens(data.session, data.user.id)
      return NextResponse.redirect(`${origin}${next}`)
    }

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', error)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

// Supabase Auth doesn't refresh provider (Google) tokens on its own, and it
// doesn't surface the provider access token's real expiry either — so we
// record it as already-expired and let lib/google/token.ts do a refresh on
// first use, rather than guessing Google's expires_in.
async function storeGoogleCalendarTokens(
  session: { provider_refresh_token?: string | null; provider_token?: string | null },
  userId: string
) {
  console.error('[auth/callback] has_provider_refresh_token:', Boolean(session.provider_refresh_token))

  if (!session.provider_refresh_token) return

  const admin = createAdminClient()
  const secretName = googleVaultSecretName(userId)

  try {
    await upsertGoogleVaultTokens(admin, secretName, {
      refresh_token: session.provider_refresh_token,
      access_token: session.provider_token ?? '',
    })
  } catch (error) {
    // Vault write failed — don't create an integrations row pointing at a
    // secret that doesn't exist.
    console.error('[auth/callback] vault_upsert_secret RPC failed:', error)
    return
  }

  const { error: integrationsError } = await admin.from('integrations').upsert(
    {
      user_id: userId,
      provider: 'google',
      connected_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      vault_secret_name: secretName,
      last_error: null,
    },
    { onConflict: 'user_id,provider' }
  )

  if (integrationsError) {
    console.error('[auth/callback] integrations upsert failed:', integrationsError)
  }
}
