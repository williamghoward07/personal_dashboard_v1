import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readGoogleVaultTokens, upsertGoogleVaultTokens } from '@/lib/google/vault'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REFRESH_MARGIN_MS = 60_000

// Thrown whenever the caller should fall back to a "Reconnect Google
// Calendar" UI state instead of a hard error — no integration on file, a
// vault read miss, or Google rejecting the refresh token outright.
export class GoogleReauthRequiredError extends Error {}

export async function getValidGoogleAccessToken(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new GoogleReauthRequiredError('Not signed in')
  }

  const admin = createAdminClient()

  const { data: integration } = await admin
    .from('integrations')
    .select('expires_at, vault_secret_name')
    .eq('provider', 'google')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!integration?.vault_secret_name) {
    throw new GoogleReauthRequiredError('No Google Calendar integration connected')
  }

  const tokens = await readGoogleVaultTokens(admin, integration.vault_secret_name)
  if (!tokens?.refresh_token) {
    throw new GoogleReauthRequiredError('Google Calendar credentials missing from vault')
  }

  const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0
  const stillValid = expiresAt - Date.now() > REFRESH_MARGIN_MS

  if (stillValid && tokens.access_token) {
    return tokens.access_token
  }

  return refreshAndStore(admin, user.id, integration.vault_secret_name, tokens.refresh_token)
}

async function refreshAndStore(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  secretName: string,
  refreshToken: string
): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const body = await res.json().catch(() => ({}) as { error?: string; access_token?: string; expires_in?: number })

  if (!res.ok) {
    if (body.error === 'invalid_grant') {
      await admin
        .from('integrations')
        .update({ last_error: 'invalid_grant' })
        .eq('provider', 'google')
        .eq('user_id', userId)
      throw new GoogleReauthRequiredError('Google refresh token is no longer valid')
    }
    throw new Error(`Google token refresh failed: ${res.status}`)
  }

  const accessToken = body.access_token as string
  const expiresInSeconds = (body.expires_in as number) ?? 3600

  // Refresh tokens don't rotate on Google's end, so we keep the one we
  // already have and only replace the access token in the stored secret.
  await upsertGoogleVaultTokens(admin, secretName, {
    refresh_token: refreshToken,
    access_token: accessToken,
  })

  await admin
    .from('integrations')
    .update({
      expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('provider', 'google')
    .eq('user_id', userId)

  return accessToken
}
