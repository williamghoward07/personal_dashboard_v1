import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface StoredGoogleTokens {
  refresh_token: string
  access_token: string
}

// One JSON secret per user holds both tokens, so the `integrations` table
// never touches plaintext credentials — only the vault secret's name.
export function googleVaultSecretName(userId: string) {
  return `google_calendar_${userId}`
}

export async function upsertGoogleVaultTokens(
  admin: SupabaseClient,
  secretName: string,
  tokens: StoredGoogleTokens
) {
  const { error } = await admin.rpc('vault_upsert_secret', {
    secret_name: secretName,
    secret_value: JSON.stringify(tokens),
  })
  if (error) throw error
}

export async function readGoogleVaultTokens(
  admin: SupabaseClient,
  secretName: string
): Promise<StoredGoogleTokens | null> {
  const { data, error } = await admin.rpc('vault_read_secret', { secret_name: secretName })
  if (error || !data) return null
  try {
    return JSON.parse(data) as StoredGoogleTokens
  } catch {
    return null
  }
}
