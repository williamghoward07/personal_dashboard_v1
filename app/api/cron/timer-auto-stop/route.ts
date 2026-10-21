import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerToken, tokensMatch } from '@/lib/timer/token'

// Vercel cron (vercel.json, daily on Hobby): stops every timer segment that
// has run 12h, at exactly started_at + 12h. /api/timer/active applies the
// same stop on read, so this only matters when no client opens the app.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; public in proxy.ts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const token = bearerToken(request.headers.get('authorization'))
  if (!secret || !token || !tokensMatch(token, secret)) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data, error } = await createAdminClient().rpc('timer_auto_stop_all')
  if (error) {
    console.error('Timer auto-stop cron failed:', error)
    return NextResponse.json({ error: 'timer_failed' }, { status: 500 })
  }
  return NextResponse.json({ stopped: data })
}
