import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import { GOOGLE_CONTACTS_PROVIDER, revokeToken } from '@/lib/google/oauth'
import type { Integration } from '@/lib/types'

/**
 * Revokes the Google grant and forgets the token.
 *
 * Synced people are deliberately left in place — they carry your notes, tags
 * and interaction history, which are yours, not Google's.
 */
export async function POST() {
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

  if (!integration) return NextResponse.json({ disconnected: true })

  if (integration.encrypted_refresh_token) {
    try {
      await revokeToken(decryptSecret(integration.encrypted_refresh_token))
    } catch {
      // An unreadable or already-dead token still gets removed below.
    }
  }

  const { error } = await supabase.from('integrations').delete().eq('id', integration.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ disconnected: true })
}
