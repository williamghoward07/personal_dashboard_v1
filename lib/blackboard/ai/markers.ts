// Progress markers stored in the existing "processed hash" columns
// (bb_content_ai.classified_hash / extracted_hash, bb_announcements.ai_hash,
// bb_documents.ai_hash), so failures and long documents need no schema
// change. A real hash is md5 hex and never contains ':', so a marker can
// never be mistaken for one. Every marker carries the source hash it was
// written for: once the text changes, the marker no longer applies and the
// row is planned normally. Pure.
//
//   <hash>                         done
//   retry:<hash>                   a multi-item batch failed: plan this row alone
//   fail:<hash>                    failed on its own: leave it until a manual retry
//   partial:<nextChunk>:<hash>     a document read up to (not including) signal chunk <nextChunk>

export type HashState =
  | { kind: 'done' }
  | { kind: 'pending' }
  | { kind: 'retry' }
  | { kind: 'failed' }
  | { kind: 'partial'; next: number }

export const retryMarker = (hash: string) => `retry:${hash}`
export const failMarker = (hash: string) => `fail:${hash}`
export const partialMarker = (next: number, hash: string) => `partial:${next}:${hash}`

/** What a stored column value means for a row whose source hash is now `current`. */
export function hashState(stored: string | null | undefined, current: string): HashState {
  if (!stored) return { kind: 'pending' }
  if (!stored.includes(':')) return stored === current ? { kind: 'done' } : { kind: 'pending' }
  const retry = /^retry:(.+)$/.exec(stored)
  if (retry) return retry[1] === current ? { kind: 'retry' } : { kind: 'pending' }
  const fail = /^fail:(.+)$/.exec(stored)
  if (fail) return fail[1] === current ? { kind: 'failed' } : { kind: 'pending' }
  const partial = /^partial:(\d+):(.+)$/.exec(stored)
  if (partial && partial[2] === current) return { kind: 'partial', next: Number(partial[1]) }
  // Anything else (a stale or unknown marker) is simply "needs work".
  return { kind: 'pending' }
}

export const isDone = (stored: string | null | undefined, current: string) => hashState(stored, current).kind === 'done'
