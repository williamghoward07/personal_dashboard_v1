import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'
import { NOTE_MAX, parseJsonObject, parseOptionalInstant, parseOptionalText } from '@/lib/timer/validate'

// { trim_to?, note? } -> stops the open session. trim_to is an ISO instant
// with an offset ("I actually stopped at 14:30"); it must fall inside the
// last segment, never before its start or after now (400 invalid_trim).
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = parseJsonObject(await request.text())
  const trimTo = parseOptionalInstant(body?.trim_to)
  const note = parseOptionalText(body?.note, NOTE_MAX)
  if (!body || !trimTo.ok || !note.ok) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const { data, error } = await caller.supabase.rpc('timer_stop', {
    p_trim_to: trimTo.value,
    p_note: note.value,
    p_user_id: caller.userId,
  })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer stop failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json({ session: data })
}
