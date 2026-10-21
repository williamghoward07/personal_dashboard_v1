import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'
import { parseLimit } from '@/lib/timer/validate'

// ?limit= (default 8) -> the most recently timed workspaces, newest first,
// for quick pickers: { workspaces: [{ workspace_id, title, last_started_at }] }.
export async function GET(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const limit = parseLimit(new URL(request.url).searchParams.get('limit'))
  if (!limit.ok) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const { data, error } = await caller.supabase.rpc('timer_recent_workspaces', {
    p_limit: limit.value,
    p_user_id: caller.userId,
  })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer recent workspaces failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json({ workspaces: data })
}
