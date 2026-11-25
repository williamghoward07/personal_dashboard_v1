import { NextResponse } from 'next/server'
import { resolveBlackboardCaller } from '@/lib/blackboard/auth'
import { parseDocumentBody } from '@/lib/blackboard/documents'
import { readJsonBody } from '@/lib/blackboard/gzip'
import type { DocumentResponse } from '@/lib/blackboard/wire'

// DocumentUpload (wire.ts) from the Chrome extension: the TEXT of one
// handbook / assessment brief, extracted in the browser. File bytes never
// reach this route and nothing here fetches from Blackboard.
// Plain JSON, or gzipped with Content-Type GZIP_CONTENT_TYPE -> 200 { ok: true }.
// Upserts bb_documents on (user_id, bb_id). Never writes the dashboard-owned
// ai_hash, and never logs the document text or the token. No AI in this path.

/** Decompressed cap: 500k characters of text is at most ~2 MB of UTF-8 JSON. */
const MAX_BODY_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  const caller = resolveBlackboardCaller(request)
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await readJsonBody(request, MAX_BODY_BYTES)
  if (!body.ok) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const parsed = parseDocumentBody(body.value)
  if (!parsed.ok) return NextResponse.json({ error: 'invalid_request', detail: parsed.error }, { status: 400 })
  const doc = parsed.value
  const { supabase, userId } = caller

  const { data: content, error: lookupError } = await supabase
    .from('bb_content')
    .select('id')
    .eq('user_id', userId)
    .eq('bb_id', doc.content_bb_id)
    .is('removed_at', null)
    .maybeSingle()
  if (lookupError) return failed(lookupError.message)
  if (!content) return NextResponse.json({ error: 'unknown_content' }, { status: 404 })

  const { error } = await supabase.from('bb_documents').upsert(
    {
      user_id: userId,
      bb_id: doc.bb_id,
      content_id: (content as { id: string }).id,
      file_name: doc.file_name,
      mime_type: doc.mime_type,
      byte_size: doc.byte_size,
      version: doc.version,
      page_count: doc.page_count,
      text: doc.text,
      fetched_at: new Date().toISOString(),
      removed_at: null,
    },
    { onConflict: 'user_id,bb_id' },
  )
  if (error) return failed(error.message)
  return NextResponse.json({ ok: true } satisfies DocumentResponse)
}

function failed(detail: string) {
  // The DB message only (never the request body).
  console.error('Blackboard document upload failed:', detail)
  return NextResponse.json({ error: 'document_failed', detail }, { status: 500 })
}
