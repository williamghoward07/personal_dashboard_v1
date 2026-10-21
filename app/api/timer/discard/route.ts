import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'

// Soft-discards the open session: ended_reason 'discarded', dropped from
// every total. Nothing is deleted.
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await caller.supabase.rpc('timer_discard', { p_user_id: caller.userId })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer discard failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json({ session: data })
}
