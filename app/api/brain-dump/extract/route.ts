import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractBrainDump } from '@/lib/braindump/extract'

// Draft-only — never writes. Confirming an individual draft calls the
// existing per-kind write endpoints from the client (app/api/search/act/
// confirm for todo/education_task/calendar_event, or the same
// people/interactions inserts QuickAddBar already uses).
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { text?: string }
  const text = body.text?.trim()

  if (!text) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // Only id + name sent to Gemini, never full contact records — same
  // privacy tradeoff as app/api/people/nl-extract.
  const { data: people } = await supabase.from('people').select('id, full_name').eq('archived', false)

  try {
    const result = await extractBrainDump(text, people ?? [], new Date().toISOString())
    return NextResponse.json(result)
  } catch (err) {
    console.error('Brain dump extraction failed:', err)
    const message = err instanceof Error ? err.message : 'extract_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
