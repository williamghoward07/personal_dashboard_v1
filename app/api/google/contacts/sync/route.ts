import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import { GOOGLE_CONTACTS_PROVIDER, refreshAccessToken } from '@/lib/google/oauth'
import {
  GOOGLE_OWNED_FIELDS,
  SyncTokenExpiredError,
  fetchConnections,
  mapGooglePerson,
} from '@/lib/google/people'
import type { Integration } from '@/lib/types'

/**
 * Pulls Google contacts into `people`.
 *
 * Only the Google-owned contact-card columns are written; notes, tags and
 * how_we_met are left alone, and manually-created people (null
 * google_resource_name) are never matched.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', GOOGLE_CONTACTS_PROVIDER)
    .maybeSingle<Integration>()

  if (!integration?.encrypted_refresh_token) {
    return NextResponse.json({ error: 'Google Contacts is not connected' }, { status: 400 })
  }

  const recordFailure = async (message: string) => {
    await supabase
      .from('integrations')
      .update({ last_error: message })
      .eq('id', integration.id)
  }

  // A full resync is requested by the UI after a token expiry, and forced
  // automatically when Google rejects the stored cursor.
  const url = new URL(request.url)
  const forceFull = url.searchParams.get('full') === '1'

  try {
    const refreshToken = decryptSecret(integration.encrypted_refresh_token)
    const tokens = await refreshAccessToken(refreshToken)

    let result
    try {
      result = await fetchConnections({
        accessToken: tokens.access_token,
        syncToken: forceFull ? null : integration.sync_token,
      })
    } catch (error) {
      if (!(error instanceof SyncTokenExpiredError)) throw error
      result = await fetchConnections({ accessToken: tokens.access_token, syncToken: null })
    }

    const mapped = result.people
      .map(mapGooglePerson)
      .filter((p): p is NonNullable<typeof p> => p !== null)

    let imported = 0
    if (mapped.length > 0) {
      // onConflict targets the partial unique index on (user_id,
      // google_resource_name); ignoreDuplicates stays false so existing rows
      // get their contact card refreshed.
      const { error } = await supabase
        .from('people')
        .upsert(mapped, { onConflict: 'user_id,google_resource_name', ignoreDuplicates: false })
      if (error) {
        await recordFailure(`Couldn't save contacts: ${error.message}`)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      imported = mapped.length
    }

    await supabase
      .from('integrations')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_token: result.nextSyncToken,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        last_error: null,
      })
      .eq('id', integration.id)

    return NextResponse.json({ imported, updatedFields: GOOGLE_OWNED_FIELDS.length })
  } catch (error) {
    // The overwhelmingly common cause is a refresh token expired by Google's
    // 7-day limit for apps still in Testing. Say so plainly — the card renders
    // last_error verbatim.
    const message =
      error instanceof Error && /invalid_grant/i.test(error.message)
        ? 'Google sign-in expired — click Reconnect to re-authorise.'
        : error instanceof Error
          ? error.message
          : 'Unknown sync error'
    await recordFailure(message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
