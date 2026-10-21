import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'
import { LABEL_MAX, isUuid, parseClient, parseJsonObject, parseOptionalText } from '@/lib/timer/validate'

// { workspace_id, label?, client? } -> 201 { session }. If a session is
// already open (running or paused) nothing starts: 409 with that session,
// so the client can offer /api/timer/switch.
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = parseJsonObject(await request.text())
  const label = parseOptionalText(body?.label, LABEL_MAX)
  const client = parseClient(body?.client)
  if (!body || !isUuid(body.workspace_id) || !label.ok || !client.ok) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const { data, error } = await caller.supabase.rpc('timer_start', {
    p_workspace_id: body.workspace_id,
    p_label: label.value,
    p_client: client.value,
    p_user_id: caller.userId,
  })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer start failed:', error)
    return NextResponse.json({ error: key }, { status })
  }

  if (data.conflict) return NextResponse.json({ error: 'session_open', session: data.session }, { status: 409 })
  return NextResponse.json({ session: data.session }, { status: 201 })
}
