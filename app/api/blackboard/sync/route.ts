import { NextResponse } from 'next/server'
import { resolveBlackboardCaller } from '@/lib/blackboard/auth'
import { normaliseSnapshot, parseSyncBody } from '@/lib/blackboard/normalise'

// { trigger?, snapshot } from the Chrome extension -> 200 { counts }.
// The snapshot is normalised here and applied in one transaction by
// bb_sync_apply (upsert, scoped removed_at, bb_sync_runs row), so posting
// the same snapshot twice is a no-op apart from last_seen_at.
// No AI in this path.
export async function POST(request: Request) {
  const caller = resolveBlackboardCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const parsed = parseSyncBody(body)
  if (!parsed) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const rows = normaliseSnapshot(parsed.snapshot, parsed.trigger)
  const { data, error } = await caller.supabase.rpc('bb_sync_apply', { p_payload: rows, p_user_id: caller.userId })
  if (error) {
    console.error('Blackboard sync failed:', error)
    // The RPC rolled back, so log the failed run on its own (best effort).
    await caller.supabase.from('bb_sync_runs').insert({
      user_id: caller.userId,
      started_at: rows.started_at,
      trigger: rows.trigger,
      ok: false,
      error: error.message.slice(0, 1000),
    })
    // Only the token holder sees this, and the message (e.g. "function not
    // found" before the migration is applied) is what the side panel shows.
    return NextResponse.json({ error: 'sync_failed', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ counts: data })
}
