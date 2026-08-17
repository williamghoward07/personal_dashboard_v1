import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface CommitRow {
  occurred_at: string
  activity_type: string
  duration_minutes: number | null
  distance_km: number | null
  elevation_gain_m: number | null
  external_id: string | null
}

// Bulk-commits reviewed Strava CSV rows via the upsert_activity_sessions
// RPC (see 20260817000000_activity_sessions.sql) — a plain .insert()
// can't express "update in place if this Activity ID was already
// imported," and PostgREST's .upsert() can't target the partial unique
// index this needs. Runs under the normal session-scoped client; the RPC
// itself pins user_id to auth.uid(), so nothing here needs to re-derive
// or trust a client-supplied one.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = (await request.json()) as { rows?: CommitRow[] }
  const { rows } = body

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const { error } = await supabase.rpc('upsert_activity_sessions', { rows })

  if (error) {
    console.error('Activity import commit failed:', error)
    return NextResponse.json({ error: 'commit_failed' }, { status: 502 })
  }

  return NextResponse.json({ committed: rows.length })
}
