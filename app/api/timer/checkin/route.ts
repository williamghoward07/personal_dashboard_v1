import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'

// "Keep going" on the 4h check-in: no prompt again until the next 4h mark.
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await caller.supabase.rpc('timer_checkin', { p_user_id: caller.userId })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer check-in failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json({ session: data })
}
