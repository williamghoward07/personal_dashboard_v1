import { createHash, timingSafeEqual } from 'node:crypto'

// Bearer-token checks for the Focus Timer's non-browser clients (Mac menu
// bar, Shortcuts, phone) and the cron route. Pure so they're testable.

/** The token from an `Authorization: Bearer <token>` header, else null. */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i)
  return match ? match[1] : null
}

/**
 * Constant-time comparison. Hashing first gives timingSafeEqual two
 * equal-length buffers, so a wrong guess doesn't leak the token's length.
 */
export function tokensMatch(given: string, expected: string): boolean {
  if (!given || !expected) return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
