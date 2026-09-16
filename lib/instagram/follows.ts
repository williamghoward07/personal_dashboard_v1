import type { SupabaseClient } from '@supabase/supabase-js'
import type { InstagramFollow } from '@/lib/types'

// Parses Instagram's own "Download your information" export
// (following.json), which looks like:
//   { "relationships_following": [
//     { "string_list_data": [{ "value": "sam.k", "href": "...", "timestamp": 1737000000 }] }
//   ] }
// Only the first string_list_data entry per relationship is used — that's
// the account itself.

export interface ParsedFollow {
  handle: string
  followed_at: string
}

export type ParseResult = { ok: true; follows: ParsedFollow[] } | { ok: false; error: string }

const HANDLE = /^[a-z0-9._]{1,30}$/

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export function parseFollowingExport(json: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, error: "That isn't valid JSON." }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'Expected a JSON object with a "relationships_following" list — is this following.json?' }
  }

  const list = (data as Record<string, unknown>).relationships_following
  if (!Array.isArray(list)) {
    return { ok: false, error: 'Missing "relationships_following" — is this following.json from the Instagram export?' }
  }

  const seen = new Set<string>()
  const follows: ParsedFollow[] = []
  for (const [i, entry] of list.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      return { ok: false, error: `Entry #${i + 1} is not an object.` }
    }
    const stringListData = (entry as Record<string, unknown>).string_list_data
    if (!Array.isArray(stringListData) || stringListData.length === 0) {
      return { ok: false, error: `Entry #${i + 1} has no "string_list_data".` }
    }
    const item = stringListData[0] as Record<string, unknown> | null
    const rawValue = item?.value
    const timestamp = item?.timestamp
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      return { ok: false, error: `Entry #${i + 1} has no "value" (handle).` }
    }
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
      return { ok: false, error: `Entry #${i + 1} ("${rawValue}") has no numeric "timestamp".` }
    }
    const handle = normalizeHandle(rawValue)
    if (!HANDLE.test(handle)) {
      return { ok: false, error: `"${rawValue}" isn't a valid Instagram handle.` }
    }
    if (seen.has(handle)) continue
    seen.add(handle)
    follows.push({ handle, followed_at: new Date(timestamp * 1000).toISOString() })
  }

  if (follows.length === 0) {
    return { ok: false, error: 'No follows found in "relationships_following".' }
  }
  return { ok: true, follows }
}

/**
 * Inserts only handles not already stored for this user; existing rows'
 * note/display_name/person_id are never touched. Returns how many rows
 * were added.
 */
export async function upsertFollows(supabase: SupabaseClient, follows: ParsedFollow[]): Promise<number> {
  if (follows.length === 0) return 0
  const { data, error } = await supabase
    .from('instagram_follows')
    .upsert(
      follows.map((f) => ({ handle: f.handle, followed_at: f.followed_at })),
      { onConflict: 'user_id,handle', ignoreDuplicates: true }
    )
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length
}

export async function listFollows(supabase: SupabaseClient): Promise<InstagramFollow[]> {
  const { data, error } = await supabase
    .from('instagram_follows')
    .select('*')
    .order('followed_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as InstagramFollow[]
}

export async function linkFollow(supabase: SupabaseClient, id: string, personId: string): Promise<void> {
  const { error } = await supabase.from('instagram_follows').update({ person_id: personId }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function unlinkFollow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('instagram_follows').update({ person_id: null }).eq('id', id)
  if (error) throw new Error(error.message)
}
