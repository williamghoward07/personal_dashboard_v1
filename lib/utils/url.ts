// URL helpers shared by every "add a link" flow (App Library, workspace
// sources, readings). Pure so the duplicate rules are testable.

/** Parses a typed URL, adding https:// when the scheme is missing. */
export function normalizeUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).toString()
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString()
    } catch {
      return null
    }
  }
}

/**
 * Whether typed text is meant as a link rather than words: no spaces, and
 * either a scheme or a dotted host ("durham.rl.talis.com/…"). "ch. 2" and
 * "Read Harvey" are text.
 */
export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  if (/^https?:\/\//i.test(trimmed)) return normalizeUrl(trimmed) !== null
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}([/?#:].*)?$/i.test(trimmed)
}

/**
 * A comparison key for spotting duplicates: ignores scheme, "www.", case of
 * the host, a trailing slash and the #fragment. Query strings still count —
 * two different ?id= pages are different links.
 */
export function urlKey(rawUrl: string): string | null {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized) return null
  const url = new URL(normalized)
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const path = url.pathname.replace(/\/+$/, '')
  return `${host}${url.port ? `:${url.port}` : ''}${path}${url.search}`
}

/** The first existing item whose URL matches `rawUrl`, if any. */
export function findDuplicateUrl<T extends { url: string }>(items: readonly T[], rawUrl: string): T | null {
  const key = urlKey(rawUrl)
  if (!key) return null
  return items.find((item) => urlKey(item.url) === key) ?? null
}
