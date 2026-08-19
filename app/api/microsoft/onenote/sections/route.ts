import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MICROSOFT_ONENOTE_PROVIDER } from '@/lib/microsoft/oauth'
import { getAccessToken, listAllSectionsFlattened } from '@/lib/microsoft/graph'
import type { Integration } from '@/lib/types'

/**
 * Lists every OneNote section across every notebook, for the "choose a
 * section" picker in the module edit modal. Called only when that picker
 * is opened — never on page load, never polled.
 */
export async function GET() {
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
    .eq('provider', MICROSOFT_ONENOTE_PROVIDER)
    .maybeSingle<Integration>()

  if (!integration) {
    return NextResponse.json({ error: 'Microsoft OneNote is not connected' }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken(integration)
    const sections = await listAllSectionsFlattened(accessToken)
    return NextResponse.json({ sections })
  } catch (error) {
    const message =
      error instanceof Error && /invalid_grant/i.test(error.message)
        ? 'Microsoft sign-in expired — click Reconnect to re-authorise.'
        : error instanceof Error
          ? error.message
          : 'Unknown error listing sections'
    await supabase.from('integrations').update({ last_error: message }).eq('id', integration.id)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
