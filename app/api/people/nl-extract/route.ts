import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPeopleUpdate } from '@/lib/people/nl-extract'

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

  // Only id + name sent to Gemini, never full contact records — deliberately
  // minimizes what leaves the app, given the free tier's prompt-improvement
  // caveat matters more here (personal contact data) than for search.
  const { data: people } = await supabase.from('people').select('id, full_name').eq('archived', false)

  try {
    const result = await extractPeopleUpdate(text, people ?? [], new Date().toISOString())
    return NextResponse.json(result)
  } catch (err) {
    console.error('People NL extract failed:', err)
    const message = err instanceof Error ? err.message : 'extract_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
