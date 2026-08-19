import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MICROSOFT_ONENOTE_PROVIDER } from '@/lib/microsoft/oauth'
import { getAccessToken, listPages } from '@/lib/microsoft/graph'
import type { Integration } from '@/lib/types'

/** Lists pages in a section. Called only when a module's notes panel opens. */
export async function GET(request: Request) {
  const sectionId = new URL(request.url).searchParams.get('sectionId')
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })
  }

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
    const pages = await listPages(accessToken, sectionId)
    return NextResponse.json({ pages })
  } catch (error) {
    const message =
      error instanceof Error && /invalid_grant/i.test(error.message)
        ? 'Microsoft sign-in expired — click Reconnect to re-authorise.'
        : error instanceof Error
          ? error.message
          : 'Unknown error listing pages'
    await supabase.from('integrations').update({ last_error: message }).eq('id', integration.id)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
