// Postgres-safe text for the sync payload. Pure: this is bundled into the
// Chrome extension, so no `server-only`, Next, Supabase or `chrome.*` imports.

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g

/** Drops NUL, which Postgres text columns reject. */
export function stripNul(text: string): string {
  return text.replace(/\u0000/g, '')
}

/** Cuts to at most `max` UTF-16 units without leaving half a surrogate pair. */
export function safeClip(text: string, max: number): string {
  if (text.length <= max) return text
  const out = text.slice(0, max)
  return /[\ud800-\udbff]$/.test(out) ? out.slice(0, -1) : out
}

/**
 * Text that Postgres will accept: no NUL, no lone surrogate (replaced with
 * U+FFFD), and a cut at `max` that never leaves half a surrogate pair. One
 * bad character in the sync payload would make the whole bb_sync_apply call
 * fail, every sync, until Blackboard's text changed.
 */
export function cleanText(text: string, max = Infinity): string {
  return safeClip(stripNul(text), max).replace(LONE_SURROGATE, '�')
}
