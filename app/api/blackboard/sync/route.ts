import { NextResponse } from 'next/server'
import { resolveBlackboardCaller, type BlackboardCaller } from '@/lib/blackboard/auth'
import { wantedDocuments } from '@/lib/blackboard/documents'
import { readJsonBody } from '@/lib/blackboard/gzip'
import { normaliseSnapshot, parseSyncBody, type BbContentRow } from '@/lib/blackboard/normalise'
import type { SyncResponse, WantedDocument } from '@/lib/blackboard/wire'

// { trigger?, snapshot } from the Chrome extension (plain JSON, or gzipped
// with Content-Type GZIP_CONTENT_TYPE) -> 200 SyncResponse { counts, wanted }.
// The snapshot is normalised here and applied in one transaction by
// bb_sync_apply (upsert, scoped removed_at, bb_sync_runs row), so posting
// the same snapshot twice is a no-op apart from last_seen_at.
// `wanted` lists the handbooks / briefs the extension should read next.
// No AI in this path.

export const maxDuration = 60

/** Decompressed cap; a real snapshot is a few MB. */
const MAX_BODY_BYTES = 64 * 1024 * 1024

export async function POST(request: Request) {
  const caller = resolveBlackboardCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await readJsonBody(request, MAX_BODY_BYTES)
  if (!body.ok) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const parsed = parseSyncBody(body.value)
  if (!parsed) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const rows = normaliseSnapshot(parsed.snapshot, parsed.trigger)
  const { data, error } = await caller.supabase.rpc('bb_sync_apply', { p_payload: rows, p_user_id: caller.userId })
  if (error) {
    console.error('Blackboard sync failed:', error)
    // The RPC rolled back, so log the failed run on its own (best effort).
    await caller.supabase.from('bb_sync_runs').insert({
      user_id: caller.userId,
      started_at: rows.started_at,
      trigger: rows.trigger,
      ok: false,
      error: error.message.slice(0, 1000),
    })
    // Only the token holder sees this, and the message (e.g. "function not
    // found" before the migration is applied) is what the side panel shows.
    return NextResponse.json({ error: 'sync_failed', detail: error.message }, { status: 500 })
  }
  const wanted = await wantedFor(caller, rows.content)
  return NextResponse.json({ counts: data, wanted } satisfies SyncResponse)
}

function contentBbId(embed: unknown): string | null {
  const row = Array.isArray(embed) ? embed[0] : embed
  const id = row && typeof row === 'object' ? (row as { bb_id?: unknown }).bb_id : null
  return typeof id === 'string' ? id : null
}

/**
 * Documents to read next. Fails soft: before the 20261113000000 migration
 * (no bb_content_ai / bb_documents) or on any other error, the sync still
 * succeeds and the extension reads nothing.
 */
async function wantedFor({ supabase, userId }: BlackboardCaller, content: BbContentRow[]): Promise<WantedDocument[]> {
  try {
    const [ai, docs] = await Promise.all([
      supabase
        .from('bb_content_ai')
        .select('content:bb_content!inner(bb_id)')
        .eq('user_id', userId)
        .eq('read_with_ai', true),
      supabase
        .from('bb_documents')
        .select('bb_id, version, content:bb_content!inner(bb_id)')
        .eq('user_id', userId)
        .is('removed_at', null),
    ])
    if (ai.error) throw ai.error
    if (docs.error) throw docs.error

    const readWithAi = new Set<string>()
    for (const row of (ai.data ?? []) as { content: unknown }[]) {
      const id = contentBbId(row.content)
      if (id) readWithAi.add(id)
    }
    const known = new Map<string, Record<string, string>>()
    for (const row of (docs.data ?? []) as { bb_id: unknown; version: unknown; content: unknown }[]) {
      const id = contentBbId(row.content)
      if (!id || typeof row.bb_id !== 'string') continue
      const versions = known.get(id) ?? {}
      versions[row.bb_id] = typeof row.version === 'string' ? row.version : ''
      known.set(id, versions)
    }
    return wantedDocuments(content, { readWithAi, known })
  } catch (err) {
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err)
    console.warn('Blackboard wanted documents skipped:', message)
    return []
  }
}
