import { NextResponse } from 'next/server'
import { resolveTimerCaller } from '@/lib/timer/auth'
import { timerError } from '@/lib/timer/errors'
import { LABEL_MAX, isUuid, parseClient, parseJsonObject, parseOptionalText } from '@/lib/timer/validate'

// { workspace_id, label?, client? } -> stops the open session (if any) and
// starts a new one in one transaction: { stopped, session }.
export async function POST(request: Request) {
  const caller = await resolveTimerCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = parseJsonObject(await request.text())
  const label = parseOptionalText(body?.label, LABEL_MAX)
  const client = parseClient(body?.client)
  if (!body || !isUuid(body.workspace_id) || !label.ok || !client.ok) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const { data, error } = await caller.supabase.rpc('timer_switch', {
    p_workspace_id: body.workspace_id,
    p_label: label.value,
    p_client: client.value,
    p_user_id: caller.userId,
  })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Timer switch failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json(data)
}
