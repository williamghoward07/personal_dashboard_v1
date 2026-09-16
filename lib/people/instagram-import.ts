import type { InstagramAccount } from '@/lib/types'

// Browser-side half of the Instagram log import: validate and normalise
// the JSON Claude produced from screenshots, and preview what an import
// would add. The database function import_instagram_snapshot applies the
// same rules authoritatively (20260917030000_instagram_log.sql):
//   * an event only the first time a relationship is seen
//   * a baseline import records accounts without logging events
//   * nobody is ever marked as unfollowed (screenshots are partial)

export interface SnapshotEntry {
  username: string
  display_name: string | null
  approx_date: string | null
}

export interface InstagramSnapshot {
  captured_on: string
  baseline: boolean
  following: SnapshotEntry[]
  followers: SnapshotEntry[]
}

export type ParseResult = { ok: true; snapshot: InstagramSnapshot } | { ok: false; error: string }

const USERNAME = /^[a-z0-9._]{1,30}$/
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Pulls the JSON object out of a pasted reply (tolerates ``` fences and chatter around it). */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

function parseList(value: unknown, label: string, capturedOn: string): SnapshotEntry[] | string {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return `"${label}" should be a list.`
  const seen = new Set<string>()
  const entries: SnapshotEntry[] = []
  for (const [i, item] of value.entries()) {
    const raw = typeof item === 'string' ? item : (item as { username?: unknown } | null)?.username
    if (typeof raw !== 'string') return `${label} #${i + 1} has no username.`
    const username = normalizeUsername(raw)
    if (!USERNAME.test(username)) return `${label} #${i + 1}: "${raw}" isn't a valid Instagram username.`
    if (seen.has(username)) continue
    seen.add(username)

    const obj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    const displayName = typeof obj.display_name === 'string' && obj.display_name.trim() ? obj.display_name.trim() : null
    let approxDate = isDateKey(obj.approx_date) ? obj.approx_date : null
    if (approxDate && approxDate > capturedOn) approxDate = capturedOn
    entries.push({ username, display_name: displayName, approx_date: approxDate })
  }
  return entries
}

export function parseInstagramSnapshot(text: string, todayKey: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(extractJson(text))
  } catch {
    return { ok: false, error: "That isn't valid JSON — paste Claude's whole reply, including the braces." }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'Expected a JSON object with "captured_on", "following" and "followers".' }
  }
  const obj = data as Record<string, unknown>

  const capturedOn = obj.captured_on ?? todayKey
  if (!isDateKey(capturedOn)) return { ok: false, error: '"captured_on" should be a date like 2026-09-16.' }
  if (capturedOn > todayKey) return { ok: false, error: '"captured_on" is in the future.' }

  const following = parseList(obj.following, 'following', capturedOn)
  if (typeof following === 'string') return { ok: false, error: following }
  const followers = parseList(obj.followers, 'followers', capturedOn)
  if (typeof followers === 'string') return { ok: false, error: followers }
  if (following.length === 0 && followers.length === 0) {
    return { ok: false, error: 'No accounts found in "following" or "followers".' }
  }

  return {
    ok: true,
    snapshot: { captured_on: capturedOn, baseline: obj.baseline === true, following, followers },
  }
}

export interface SnapshotPreview {
  newFollowing: SnapshotEntry[]
  newFollowers: SnapshotEntry[]
  /** Accounts not seen in any earlier import. */
  newAccounts: number
  /** Entries that change nothing. */
  unchanged: number
}

type KnownAccount = Pick<InstagramAccount, 'username' | 'i_follow' | 'follows_me'>

/** What importing `snapshot` would add, given the accounts already logged. */
export function previewSnapshot(snapshot: InstagramSnapshot, known: KnownAccount[]): SnapshotPreview {
  const byName = new Map(known.map((a) => [a.username, a]))
  const newFollowing = snapshot.following.filter((e) => !byName.get(e.username)?.i_follow)
  const newFollowers = snapshot.followers.filter((e) => !byName.get(e.username)?.follows_me)
  const names = new Set([...snapshot.following, ...snapshot.followers].map((e) => e.username))
  const newAccounts = [...names].filter((n) => !byName.has(n)).length
  const unchanged =
    snapshot.following.length - newFollowing.length + (snapshot.followers.length - newFollowers.length)
  return { newFollowing, newFollowers, newAccounts, unchanged }
}

export type RelationshipLabel = 'Mutual' | 'You follow' | 'Follows you' | null

export function relationshipLabel(account: Pick<InstagramAccount, 'i_follow' | 'follows_me'>): RelationshipLabel {
  if (account.i_follow && account.follows_me) return 'Mutual'
  if (account.i_follow) return 'You follow'
  if (account.follows_me) return 'Follows you'
  return null
}
