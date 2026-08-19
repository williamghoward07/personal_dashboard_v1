import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MICROSOFT_ONENOTE_PROVIDER } from '@/lib/microsoft/oauth'

/**
 * Forgets the stored Microsoft token.
 *
 * There's no public Microsoft identity platform token-revocation endpoint
 * to call (unlike Google's /revoke) — deleting the local row is all this
 * app can do. To fully cut the app's access off Microsoft's side, revoke
 * it manually at https://account.live.com/consent.
 *
 * Linked modules (onenote_section_id/onenote_section_name) are deliberately
 * left in place — reconnecting immediately restores browsing.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('provider', MICROSOFT_ONENOTE_PROVIDER)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ disconnected: true })
}
