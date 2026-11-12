import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerToken, tokensMatch } from '@/lib/timer/token'

// Who is calling a /api/blackboard/* route: only the Chrome extension, which
// sends `Authorization: Bearer $BLACKBOARD_SYNC_TOKEN`. It has no dashboard
// session, so it gets the service-role client and acts as
// BLACKBOARD_OWNER_USER_ID (bb_sync_apply filters every write by that id).
//
// Same shape as lib/timer/auth.ts, but token-only and with its own token,
// so leaking one doesn't open the other. Only /api/blackboard/* imports
// this. /api/blackboard is public in proxy.ts because the routes check the
// caller here.

export interface BlackboardCaller {
  supabase: SupabaseClient
  userId: string
}

export function resolveBlackboardCaller(request: Request): BlackboardCaller | null {
  const token = bearerToken(request.headers.get('authorization'))
  const expected = process.env.BLACKBOARD_SYNC_TOKEN
  const ownerId = process.env.BLACKBOARD_OWNER_USER_ID
  // Unset env vars disable the route entirely.
  if (!token || !expected || !ownerId || !tokensMatch(token, expected)) return null
  return { supabase: createAdminClient(), userId: ownerId }
}
