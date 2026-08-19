import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MICROSOFT_ONENOTE_PROVIDER } from '@/lib/microsoft/oauth'
import { getAccessToken } from '@/lib/microsoft/graph'
import type { Integration } from '@/lib/types'

/**
 * Streams a single OneNote page image resource, authenticated server-side.
 * Only ever called for graph.microsoft.com resource URLs rewritten by
 * app/api/microsoft/onenote/page/route.ts — the host check below stops
 * this from being used as an open proxy that leaks the Bearer token to an
 * arbitrary target.
 */
export async function GET(request: Request) {
  const resourceUrl = new URL(request.url).searchParams.get('resourceUrl')
  if (!resourceUrl) {
    return NextResponse.json({ error: 'resourceUrl is required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(resourceUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid resourceUrl' }, { status: 400 })
  }
  if (parsed.hostname !== 'graph.microsoft.com') {
    return NextResponse.json({ error: 'resourceUrl must point to graph.microsoft.com' }, { status: 400 })
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
    const res = await fetch(parsed.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) {
      return NextResponse.json({ error: `Image request failed (${res.status})` }, { status: 502 })
    }
    return new NextResponse(res.body, {
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error loading image'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
