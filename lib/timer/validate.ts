// Request validation for the Focus Timer routes. Pure so the rules are
// testable; the routes turn a null into a 400.

export const TIMER_CLIENTS = ['web', 'mac', 'shortcut', 'phone'] as const
export type TimerClient = (typeof TIMER_CLIENTS)[number]

export const LABEL_MAX = 200
export const NOTE_MAX = 2000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// A trim time must carry its own offset, so the server never guesses the
// client's timezone.
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

type Parsed<T> = { ok: true; value: T } | { ok: false }

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value })
const bad = { ok: false } as const

/** A JSON object body. Empty bodies are `{}` so a Shortcut can POST nothing. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) return {}
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Which device sent the request. Defaults to 'web'. */
export function parseClient(value: unknown): Parsed<TimerClient> {
  if (value === undefined || value === null) return ok('web')
  return typeof value === 'string' && (TIMER_CLIENTS as readonly string[]).includes(value)
    ? ok(value as TimerClient)
    : bad
}

/** Optional free text (label, note): trimmed, blank -> null, capped. */
export function parseOptionalText(value: unknown, max: number): Parsed<string | null> {
  if (value === undefined || value === null) return ok(null)
  if (typeof value !== 'string') return bad
  const trimmed = value.trim()
  if (trimmed.length > max) return bad
  return ok(trimmed || null)
}

/** Optional ISO 8601 instant with an offset, normalised to UTC ISO. */
export function parseOptionalInstant(value: unknown): Parsed<string | null> {
  if (value === undefined || value === null) return ok(null)
  if (typeof value !== 'string' || !INSTANT_RE.test(value)) return bad
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ok(new Date(ms).toISOString()) : bad
}

/** A real calendar date as 'YYYY-MM-DD'. */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(DATE_KEY_RE)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** `from`..`to` inclusive day range; 'YYYY-MM-DD' strings compare in order. */
export function parseDayRange(from: unknown, to: unknown): Parsed<{ from: string; to: string }> {
  if (!isDateKey(from) || !isDateKey(to) || from > to) return bad
  return ok({ from, to })
}

/** recent-workspaces ?limit=, 1..50, default 8. */
export function parseLimit(value: string | null): Parsed<number> {
  if (value === null || value === '') return ok(8)
  if (!/^\d+$/.test(value)) return bad
  const n = Number(value)
  return n >= 1 && n <= 50 ? ok(n) : bad
}
