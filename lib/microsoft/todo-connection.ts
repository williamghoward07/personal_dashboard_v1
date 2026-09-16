import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { Integration } from '@/lib/types'
import { GraphApiError, getAccessToken } from './graph'
import { MICROSOFT_ONENOTE_PROVIDER, hasTodoScope } from './oauth'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type TodoSyncState = 'not_connected' | 'needs_reconnect' | 'error'

export type TodoConnection =
  | { ok: true; accessToken: string; integrationId: string }
  | { ok: false; state: TodoSyncState; message: string }

const RECONNECT_MESSAGE = 'Reconnect Microsoft to let the app use To Do.'

/** The signed-in user's Microsoft connection, if it can be used for To Do. */
export async function getTodoConnection(supabase: ServerSupabase): Promise<TodoConnection> {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', MICROSOFT_ONENOTE_PROVIDER)
    .maybeSingle<Integration>()

  if (!integration?.encrypted_refresh_token) {
    return { ok: false, state: 'not_connected', message: 'Microsoft To Do is not connected.' }
  }
  if (!hasTodoScope(integration.scopes)) {
    return { ok: false, state: 'needs_reconnect', message: RECONNECT_MESSAGE }
  }

  try {
    return { ok: true, accessToken: await getAccessToken(integration), integrationId: integration.id }
  } catch (error) {
    // A revoked/expired refresh token needs a fresh consent; anything else
    // (network, server config) is worth just retrying.
    if (error instanceof Error && /invalid_grant/i.test(error.message)) {
      return { ok: false, state: 'needs_reconnect', message: 'Microsoft sign-in expired — reconnect to keep To Do syncing.' }
    }
    const message = error instanceof Error ? error.message : 'Could not sign in to Microsoft'
    return { ok: false, state: 'error', message }
  }
}

/** A Graph failure that re-consenting would fix (revoked or missing permission). */
export function isAuthFailure(error: unknown): boolean {
  return error instanceof GraphApiError && (error.status === 401 || error.status === 403)
}

export function friendlyGraphError(error: unknown): string {
  if (isAuthFailure(error)) return RECONNECT_MESSAGE
  return error instanceof Error ? error.message : 'Microsoft To Do request failed'
}
