import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerToken, tokensMatch } from './token'

// Who is calling a /api/timer/* route. Browsers use the normal Supabase
// session cookie. The Mac menu bar, Shortcuts and phone send
// `Authorization: Bearer $TIMER_API_TOKEN` instead: there's no session, so
// they get the service-role client and act as TIMER_OWNER_USER_ID (the
// timer RPCs filter every query by that id).
//
// Only the /api/timer/* routes import this, which is what keeps the token
// from working anywhere else. /api/timer is public in proxy.ts because
// these routes check the caller here.

export interface TimerCaller {
  supabase: SupabaseClient
  userId: string
}

export async function resolveTimerCaller(request: Request): Promise<TimerCaller | null> {
  const header = request.headers.get('authorization')
  if (header !== null) {
    const token = bearerToken(header)
    const expected = process.env.TIMER_API_TOKEN
    const ownerId = process.env.TIMER_OWNER_USER_ID
    // A wrong token is rejected outright rather than falling back to the
    // cookie. Unset env vars disable the token path entirely.
    if (!token || !expected || !ownerId || !tokensMatch(token, expected)) return null
    return { supabase: createAdminClient(), userId: ownerId }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { supabase, userId: user.id } : null
}
