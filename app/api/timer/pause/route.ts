import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'

// Ends the running segment (ended_reason 'paused'). 409 if already paused.
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await caller.supabase.rpc('timer_pause', { p_user_id: caller.userId })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer pause failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json({ session: data })
}
