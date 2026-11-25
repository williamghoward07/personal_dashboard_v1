// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_MIME_TYPES, type DocumentUpload } from '@/lib/blackboard/wire'

vi.mock('server-only', () => ({}))
const resolveCaller = vi.fn()
vi.mock('@/lib/blackboard/auth', () => ({ resolveBlackboardCaller: (r: Request) => resolveCaller(r) }))

import { POST } from './route'

const valid: DocumentUpload = {
  course_bb_id: '_100_1',
  content_bb_id: '_5_1',
  bb_id: '_att_1',
  file_name: 'Handbook.pdf',
  mime_type: DOCUMENT_MIME_TYPES[0],
  byte_size: 1234,
  version: '2026-10-01T10:00:00.000Z',
  page_count: 3,
  text: 'Essay due 16 February 2027',
}

function fakeSupabase(content: { id: string } | null, upsertError: { message: string } | null = null) {
  const upsert = vi.fn(async () => ({ error: upsertError }))
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is']) builder[m] = () => builder
  builder.maybeSingle = async () => ({ data: content, error: null })
  const supabase = { from: vi.fn((table: string) => (table === 'bb_documents' ? { upsert } : builder)) }
  return { supabase, upsert }
}

const post = (body: unknown) =>
  new Request('http://x/api/blackboard/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  resolveCaller.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/blackboard/document', () => {
  it('401s when unauthenticated', async () => {
    resolveCaller.mockReturnValue(null)
    const req = post(valid)
    expect((await POST(req)).status).toBe(401)
    expect(req.bodyUsed).toBe(false)
  })

  it('400s for a mime type outside the allowed list', async () => {
    const { supabase } = fakeSupabase({ id: 'c1' })
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(post({ ...valid, mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }))
    expect(res.status).toBe(400)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('404s unknown_content when the content row is not found', async () => {
    const { supabase, upsert } = fakeSupabase(null)
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(post(valid))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'unknown_content' })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('200s and upserts with the caller, the looked-up content id, and no ai_hash', async () => {
    const { supabase, upsert } = fakeSupabase({ id: 'content-uuid' })
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(post(valid))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const calls = upsert.mock.calls as unknown as [Record<string, unknown>, unknown][]
    const [row, options] = calls[0]
    expect(row).toMatchObject({ user_id: 'u1', content_id: 'content-uuid', bb_id: '_att_1', text: valid.text })
    expect('ai_hash' in row).toBe(false)
    expect(options).toEqual({ onConflict: 'user_id,bb_id' })
  })
})
