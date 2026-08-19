import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractActIntent, looksLikeCommand } from '@/lib/search/act'

// Returns a draft only — never writes. See app/api/search/act/confirm for
// the write, which only ever runs after the user explicitly confirms.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { query?: string }
  const query = body.query?.trim()

  if (!query) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (!looksLikeCommand(query)) {
    return NextResponse.json({ draft: null })
  }

  try {
    const result = await extractActIntent(query, new Date().toISOString())
    return NextResponse.json({ draft: result.isAction ? result.draft : null })
  } catch (err) {
    console.error('Search act extraction failed:', err)
    const message = err instanceof Error ? err.message : 'extract_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
