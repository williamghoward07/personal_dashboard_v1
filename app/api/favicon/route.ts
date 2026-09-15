import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAndCacheFavicon } from '@/lib/favicon'

// The one part of App Launcher CRUD that can't run client-side — every
// other mutation goes straight from a 'use client' component through the
// Supabase browser client (see HabitBoard.tsx).
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url : null
  if (!url) {
    return NextResponse.json({ error: 'missing_url' }, { status: 400 })
  }

  // A miss (bad domain, Google/Storage failure) isn't a request failure —
  // the caller falls back to the initial-letter tile — so this is always 200.
  const path = await fetchAndCacheFavicon(url)
  return NextResponse.json({ path })
}
