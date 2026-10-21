import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'

// The open session (running or paused) with its running seconds and 4h
// check-in flag, plus today's combined total for its workspace. Applies the
// 12h auto-stop first, so a forgotten timer is capped on read.
export async function GET(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await caller.supabase.rpc('timer_active', { p_user_id: caller.userId })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer active failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json(data)
}
