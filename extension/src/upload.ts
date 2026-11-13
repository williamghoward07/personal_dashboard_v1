// POSTs to the dashboard (never to Blackboard): gzipped when the browser has
// CompressionStream, plain JSON otherwise, with one plain-words error for
// every way it can go wrong. fetch is injected so this is testable.
import { gzipJson } from '@/lib/blackboard/gzip'
import { isBlackboardHost } from '@/lib/blackboard/links'
import { GZIP_CONTENT_TYPE } from '@/lib/blackboard/wire'

export interface UploadBytes {
  /** JSON size before compression. */
  raw: number
  /** What went over the wire. */
  sent: number
  gzip: boolean
}

export type PostOutcome<T> =
  | { ok: true; body: T; bytes: UploadBytes }
  | {
      ok: false
      error: string
      /** The dashboard can't take anything right now (unreachable, wrong address, bad token): stop sending. */
      fatal: boolean
      bytes?: UploadBytes
    }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

function isBlackboardUrl(url: string): boolean {
  try {
    return isBlackboardHost(new URL(url).hostname)
  } catch {
    return false
  }
}

export async function encodeBody(value: unknown): Promise<{ body: Uint8Array | string; contentType: string; bytes: UploadBytes }> {
  const json = JSON.stringify(value)
  const raw = new TextEncoder().encode(json).byteLength
  if (typeof CompressionStream === 'function') {
    try {
      const gz = await gzipJson(value)
      return { body: gz, contentType: GZIP_CONTENT_TYPE, bytes: { raw, sent: gz.byteLength, gzip: true } }
    } catch {
      // Fall through to plain JSON.
    }
  }
  return { body: json, contentType: 'application/json', bytes: { raw, sent: raw, gzip: false } }
}

export async function postToDashboard<T>(
  fetchFn: FetchLike,
  url: string,
  token: string,
  value: unknown,
  options: { accept: (body: unknown) => body is T; tooLarge: string },
): Promise<PostOutcome<T>> {
  // GET only towards Blackboard: a mistyped dashboard address never gets a POST.
  if (isBlackboardUrl(url)) {
    return { ok: false, fatal: true, error: 'The dashboard address points at Blackboard. Enter the Study Copilot address instead.' }
  }
  const { body, contentType, bytes } = await encodeBody(value)
  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: body as BodyInit,
    })
  } catch (err) {
    return {
      ok: false,
      fatal: true,
      bytes,
      error: `Couldn't reach the dashboard (${err instanceof Error ? err.message : String(err)}). Check the address and your connection.`,
    }
  }

  const type = res.headers.get('content-type') ?? ''
  const json: unknown = type.includes('json') ? await res.json().catch(() => null) : null
  if (res.status === 401) return { ok: false, fatal: true, bytes, error: 'The dashboard rejected the sync token.' }
  if (res.status === 413) return { ok: false, fatal: false, bytes, error: options.tooLarge }
  if (json === null) {
    // An HTML page: a login or deployment-protection page, or another site.
    return {
      ok: false,
      fatal: true,
      bytes,
      error: `The dashboard address answered with a web page (HTTP ${res.status}), not the sync API. The address is probably wrong, or the site is behind a login or protection page.`,
    }
  }
  if (res.ok && options.accept(json)) return { ok: true, body: json, bytes }
  const detail = json && typeof json === 'object' ? ((json as { detail?: unknown; error?: unknown }).detail ?? (json as { error?: unknown }).error) : undefined
  return {
    ok: false,
    fatal: false,
    bytes,
    error: `The dashboard returned ${res.status}${typeof detail === 'string' && detail ? `: ${detail}` : ''}.`,
  }
}
