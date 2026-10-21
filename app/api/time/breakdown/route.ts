import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { timerError } from '@/lib/timer/errors'
import { isUuid, parseDayRange } from '@/lib/timer/validate'

// ?workspace_id=&from=&to= -> { total, timer, manual } seconds for the
// Europe/London days from..to inclusive (workspace_id optional = all).
// Session cookie only: this is outside /api/timer/*, so TIMER_API_TOKEN
// doesn't work here (and the proxy sends token-only requests to /login).
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const workspaceId = params.get('workspace_id')
  const range = parseDayRange(params.get('from'), params.get('to'))
  if (!range.ok || (workspaceId !== null && !isUuid(workspaceId))) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('time_breakdown', {
    p_from: range.value.from,
    p_to: range.value.to,
    p_workspace_id: workspaceId,
  })
  if (error) {
    const { error: key, status } = timerError(error.message)
    if (status === 500) console.error('Time breakdown failed:', error)
    return NextResponse.json({ error: key }, { status })
  }
  return NextResponse.json(data)
}
