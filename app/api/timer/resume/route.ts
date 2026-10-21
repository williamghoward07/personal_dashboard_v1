import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'
import { parseClient, parseJsonObject } from '@/lib/timer/validate'

// { client? } -> a new segment in the paused session. 409 if it's running.
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = parseJsonObject(await request.text())
  const client = parseClient(body?.client)
  if (!body || !client.ok) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const { data, error } = await caller.supabase.rpc('timer_resume', {
    p_client: client.value,
    p_user_id: caller.userId,
  })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer resume failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json({ session: data })
}
