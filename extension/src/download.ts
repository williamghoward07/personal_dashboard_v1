// Reads one attachment's bytes into memory with a hard size limit. GET only,
// with the cookies the browser sends; the bytes are handed straight to text
// extraction and never stored. fetch is injected so this is testable.

export type DownloadResult =
  | { ok: true; bytes: Uint8Array }
  | {
      ok: false
      reason: string
      /** Over the size limit: a skip, not a failure. */
      tooLarge?: boolean
      /** Blackboard sent its login page (or SSO) instead of the file. */
      loginRequired?: boolean
    }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Where the redirect chain may end: blackboard.durham.ac.uk, alt-*.blackboard.com, *.files.blackboard.com. */
function isBlackboardHost(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'blackboard.durham.ac.uk' || host === 'blackboard.com' || host.endsWith('.blackboard.com')
  } catch {
    return false
  }
}

export async function downloadLimited(fetchFn: FetchLike, url: string, maxBytes: number): Promise<DownloadResult> {
  const controller = new AbortController()
  let res: Response
  try {
    res = await fetchFn(url, { credentials: 'include', redirect: 'follow', signal: controller.signal })
  } catch (err) {
    // A redirect Chrome won't follow (no host permission, CORS) also lands here.
    return { ok: false, reason: `download failed (${err instanceof Error ? err.message : String(err)})` }
  }
  if (res.url && !isBlackboardHost(res.url)) {
    controller.abort()
    return { ok: false, loginRequired: true, reason: `sent to ${safeHost(res.url)} instead of the file (login needed)` }
  }
  if (res.status === 401 || res.status === 403) {
    controller.abort()
    return { ok: false, reason: `Blackboard refused the download (${res.status})` }
  }
  if (!res.ok) {
    controller.abort()
    return { ok: false, reason: `Blackboard returned ${res.status} for the file` }
  }
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('text/html')) {
    controller.abort()
    return { ok: false, loginRequired: true, reason: 'Blackboard sent a web page instead of the file (login needed?)' }
  }
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    controller.abort()
    return { ok: false, tooLarge: true, reason: `larger than ${formatMb(maxBytes)} (${formatMb(declared)})` }
  }
  if (!res.body) return { ok: false, reason: 'the download had no body' }

  // Content-Length can be missing or wrong, so count while reading too.
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        controller.abort()
        return { ok: false, tooLarge: true, reason: `larger than ${formatMb(maxBytes)}` }
      }
      chunks.push(value)
    }
  } catch (err) {
    return { ok: false, reason: `download broke off (${err instanceof Error ? err.message : String(err)})` }
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, bytes }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'another site'
  }
}

export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
