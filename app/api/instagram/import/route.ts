import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseFollowingExport, upsertFollows } from '@/lib/instagram/follows'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { json?: string } | null
  const raw = body?.json
  if (typeof raw !== 'string' || !raw.trim()) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const parsed = parseFollowingExport(raw)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const added = await upsertFollows(supabase, parsed.follows)
    return NextResponse.json({ added })
  } catch (err) {
    console.error('Instagram follows import failed:', err)
    const message = err instanceof Error ? err.message : 'import_failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
