import 'server-only'
import { createAdminClient } from './supabase/admin'

const FAVICON_BUCKET = 'link-favicons'
const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons'
const FAVICON_SIZE = 128

/**
 * The one entry point every call site goes through for favicon fetch +
 * cache. Fetches url's domain favicon from Google's key-free s2/favicons
 * service and uploads it into the `link-favicons` bucket, keyed by domain
 * so repeat links to the same site reuse one cached object.
 *
 * Returns the object's path within the bucket on success, or null if the
 * URL didn't parse, the fetch failed, or the Storage upload failed. null
 * is not an error to callers — it means "use the colored initial-letter
 * fallback tile".
 */
export async function fetchAndCacheFavicon(url: string): Promise<string | null> {
  let domain: string
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  if (!domain) return null

  try {
    const faviconUrl = `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`
    const res = await fetch(faviconUrl)
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? 'image/png'
    const bytes = Buffer.from(await res.arrayBuffer())
    const path = `${domain}.png`

    const admin = createAdminClient()
    const { error } = await admin.storage.from(FAVICON_BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    })
    if (error) {
      console.error('[favicon] Storage upload failed:', error.message)
      return null
    }
    return path
  } catch (err) {
    console.error('[favicon] fetch failed:', err)
    return null
  }
}
