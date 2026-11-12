// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BB_ORIGIN, type BbSnapshot } from '@/lib/blackboard/client'
import { gzipJson } from '@/lib/blackboard/gzip'
import { GZIP_CONTENT_TYPE } from '@/lib/blackboard/wire'

vi.mock('server-only', () => ({}))
const resolveCaller = vi.fn()
vi.mock('@/lib/blackboard/auth', () => ({ resolveBlackboardCaller: (r: Request) => resolveCaller(r) }))

import { POST } from './route'

type Result = { data?: unknown; error?: { message: string } | null }

/** A thenable query builder: every chained call returns itself, awaiting gives the table's result. */
function fakeSupabase(opts: { rpc?: Result; tables?: Record<string, Result | 'throw'> } = {}) {
  const inserts: { table: string; row: unknown }[] = []
  const supabase = {
    rpc: vi.fn(async () => opts.rpc ?? { data: { content: 1 }, error: null }),
    from: vi.fn((table: string) => {
      const result = opts.tables?.[table] ?? { data: [], error: null }
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is']) builder[m] = () => builder
      builder.insert = async (row: unknown) => {
        inserts.push({ table, row })
        return { error: null }
      }
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        result === 'throw' ? Promise.reject(new Error('boom')).then(resolve, reject) : Promise.resolve(result).then(resolve, reject)
      return builder
    }),
  }
  return { supabase, inserts }
}

const snapshot = {
  version: 1,
  origin: BB_ORIGIN,
  fetchedAt: '2026-11-09T10:00:00.000Z',
  user: { id: '_9_1', userName: 'abcd12' },
  courses: [
    {
      bbId: '_100_1',
      courseCode: 'GEOG1241_2026',
      moduleCode: 'GEOG1241',
      name: 'Rivers',
      membership: {},
      course: {},
      columns: [],
      grades: [],
      announcements: [],
      contents: [
        {
          id: '_5_1',
          depth: 0,
          path: [],
          title: 'Module handbook',
          contentHandler: { id: 'resource/x-bb-file', file: { fileName: 'Handbook.pdf', mimeType: 'application/pdf' } },
        },
      ],
      skippedFolders: 0,
      errors: [],
    },
  ],
  todo: [
    { since: '2026-10-26T10:00:00.000Z', until: '2026-11-09T10:00:00.000Z', body: {} },
    { since: '2026-11-09T10:00:00.000Z', until: '2026-11-23T10:00:00.000Z', body: {} },
  ],
  errors: [],
  requestCount: 1,
  durationMs: 1,
} as unknown as BbSnapshot

const json = (body: unknown) =>
  new Request('http://x/api/blackboard/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  resolveCaller.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('POST /api/blackboard/sync', () => {
  it('401s without touching the body', async () => {
    resolveCaller.mockReturnValue(null)
    const req = json({ snapshot })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(req.bodyUsed).toBe(false)
  })

  it('accepts a plain JSON body', async () => {
    const { supabase } = fakeSupabase()
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(json({ trigger: 'manual', snapshot }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ counts: { content: 1 } })
    expect(supabase.rpc).toHaveBeenCalledWith('bb_sync_apply', expect.objectContaining({ p_user_id: 'u1' }))
  })

  it('accepts a gzip body', async () => {
    const { supabase } = fakeSupabase()
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const body = await gzipJson({ trigger: 'daily', snapshot })
    const res = await POST(
      new Request('http://x/api/blackboard/sync', { method: 'POST', headers: { 'content-type': GZIP_CONTENT_TYPE }, body: body as BodyInit }),
    )
    expect(res.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('400s on invalid gzip', async () => {
    const { supabase } = fakeSupabase()
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(
      new Request('http://x/api/blackboard/sync', {
        method: 'POST',
        headers: { 'content-type': GZIP_CONTENT_TYPE },
        body: new Uint8Array([1, 2, 3, 4, 5]) as BodyInit,
      }),
    )
    expect(res.status).toBe(400)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('500s on an RPC error and logs a failed run', async () => {
    const { supabase, inserts } = fakeSupabase({ rpc: { data: null, error: { message: 'function not found' } } })
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(json({ snapshot }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'sync_failed' })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ table: 'bb_sync_runs', row: { user_id: 'u1', ok: false } })
  })

  it('still 200s with wanted: [] when the wanted lookup throws', async () => {
    const { supabase } = fakeSupabase({ tables: { bb_content_ai: 'throw' } })
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(json({ snapshot }))
    expect(res.status).toBe(200)
    expect((await res.json()).wanted).toEqual([])
  })

  it('maps known versions as { attachmentId: version } per wanted content item', async () => {
    const { supabase } = fakeSupabase({
      tables: {
        bb_content_ai: { data: [], error: null },
        bb_documents: { data: [{ bb_id: '_att_1', version: 'v1', content: { bb_id: '_5_1' } }], error: null },
      },
    })
    resolveCaller.mockReturnValue({ supabase, userId: 'u1' })
    const res = await POST(json({ snapshot }))
    expect(res.status).toBe(200)
    expect((await res.json()).wanted).toEqual([{ course_bb_id: '_100_1', content_bb_id: '_5_1', known: { _att_1: 'v1' } }])
  })
})
