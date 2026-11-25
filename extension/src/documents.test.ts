// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BB_ORIGIN, type BbFetch, type BbSnapshot } from '@/lib/blackboard/client'
import { DOCUMENT_MAX_CHARS, type DocumentUpload, type WantedDocument } from '@/lib/blackboard/wire'
import { MAX_DOCUMENTS_PER_SYNC, documentKind, readDocuments, sniffKind, type DocumentDeps } from './documents'
import { downloadLimited } from './download'
import { postToDashboard } from './upload'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])

const snap = {
  courses: [{ bbId: '_10_1', contents: [{ id: '_5_1', modified: '2026-10-01T10:00:00.000Z' }] }],
} as unknown as BbSnapshot

const attachmentsPath = (content: string) => `/learn/api/public/v1/courses/_10_1/contents/${content}/attachments`

function bbFetch(lists: Record<string, unknown[]>): BbFetch {
  return async (url) => {
    const path = new URL(url).pathname
    const content = Object.keys(lists).find((c) => path === attachmentsPath(c))
    return content ? { status: 200, url, body: { results: lists[content] } } : { status: 404, url, body: {} }
  }
}

function deps(overrides: Partial<DocumentDeps> = {}) {
  const uploads: DocumentUpload[] = []
  const downloads: string[] = []
  const d: DocumentDeps = {
    bbFetch: bbFetch({
      _5_1: [
        { id: '_a_1', fileName: 'Handbook.pdf', mimeType: 'application/pdf' },
        { id: '_b_1', fileName: 'Brief.docx', mimeType: 'application/octet-stream' },
        { id: '_c_1', fileName: 'Week 12.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
      ],
    }),
    download: async (url) => {
      downloads.push(url)
      return { ok: true, bytes: PDF }
    },
    extract: async () => ({ text: 'Essay due 16 February 2027', pageCount: 3 }),
    upload: async (doc) => {
      uploads.push(doc)
      return { ok: true }
    },
    pause: async () => {},
    ...overrides,
  }
  return { d, uploads, downloads }
}

const want = (known: Record<string, string> = {}): WantedDocument[] => [{ course_bb_id: '_10_1', content_bb_id: '_5_1', known }]

describe('documentKind', () => {
  it('reads pdf/docx by mime, or by name when the mime is generic; never pptx', () => {
    expect(documentKind({ fileName: 'x', mimeType: 'application/pdf' })).toBe('pdf')
    expect(documentKind({ fileName: 'x.docx', mimeType: '' })).toBe('docx')
    expect(documentKind({ fileName: 'x.pdf', mimeType: 'application/vnd.ms-powerpoint' })).toBeNull()
    expect(documentKind({ fileName: 'x.pptx', mimeType: 'application/octet-stream' })).toBeNull()
  })
  it('sniffs the real type', () => {
    expect(sniffKind(PDF)).toBe('pdf')
    expect(sniffKind(new Uint8Array([0x50, 0x4b, 3, 4]))).toBe('docx')
    expect(sniffKind(new Uint8Array([60, 104]))).toBeNull()
  })
})

describe('readDocuments', () => {
  it('reads new pdf/docx files, skips slides, and sends text with the item version', async () => {
    const { d, uploads, downloads } = deps()
    const result = await readDocuments(snap, want(), d)
    expect(result).toMatchObject({ wanted: 1, read: 2, unchanged: 0, failed: [] })
    expect(result.skipped).toEqual([{ fileName: 'Week 12.pptx', reason: 'not a PDF or Word file' }])
    expect(downloads).toEqual([
      `${BB_ORIGIN}${attachmentsPath('_5_1')}/_a_1/download`,
      `${BB_ORIGIN}${attachmentsPath('_5_1')}/_b_1/download`,
    ])
    expect(uploads[0]).toEqual({
      course_bb_id: '_10_1',
      content_bb_id: '_5_1',
      bb_id: '_a_1',
      file_name: 'Handbook.pdf',
      mime_type: 'application/pdf',
      byte_size: PDF.byteLength,
      version: '2026-10-01T10:00:00.000Z',
      page_count: 3,
      text: 'Essay due 16 February 2027',
    })
  })

  it('skips files whose known version matches the item', async () => {
    const { d, downloads } = deps()
    const result = await readDocuments(snap, want({ _a_1: '2026-10-01T10:00:00.000Z', _b_1: 'older' }), d)
    expect(result.unchanged).toBe(1)
    expect(downloads).toHaveLength(1)
  })

  it('records a failure and carries on; empty text is skipped; text is cut to the limit', async () => {
    let n = 0
    const { d, uploads } = deps({
      extract: async () => {
        n++
        if (n === 1) throw new Error('bad xref')
        return { text: 'x'.repeat(DOCUMENT_MAX_CHARS + 10), pageCount: null }
      },
    })
    const result = await readDocuments(snap, want(), d)
    expect(result.failed).toEqual([{ fileName: 'Handbook.pdf', reason: "couldn't read the PDF (bad xref)" }])
    expect(result.read).toBe(1)
    expect(uploads[0].text).toHaveLength(DOCUMENT_MAX_CHARS)

    const empty = deps({ extract: async () => ({ text: ' \f \n', pageCount: 2 }) })
    const r2 = await readDocuments(snap, want(), empty.d)
    expect(r2.skipped.filter((s) => s.reason.startsWith('no text'))).toHaveLength(2)
    expect(empty.uploads).toHaveLength(0)
  })

  it('does not download a given-up file again at the same version, but does when the version changes', async () => {
    const first = deps({ extract: async () => ({ text: ' ', pageCount: 1 }) })
    const r1 = await readDocuments(snap, want(), first.d)
    expect(Object.keys(r1.settled).sort()).toEqual(['_a_1', '_b_1'])
    expect(JSON.stringify(r1.settled)).not.toMatch(/Handbook|Brief/)
    const settled = Object.fromEntries(Object.entries(r1.settled).map(([id, v]) => [id, v.version]))

    const again = deps({ settled })
    await readDocuments(snap, want(), again.d)
    expect(again.downloads).toHaveLength(0)

    const changed = deps({ settled })
    const newer = { courses: [{ bbId: '_10_1', contents: [{ id: '_5_1', modified: '2026-11-01T10:00:00.000Z' }] }] } as unknown as BbSnapshot
    await readDocuments(newer, want(), changed.d)
    expect(changed.downloads).toHaveLength(2)
  })

  it('stops when the session is gone, without failing', async () => {
    const lost: BbFetch = async () => ({ status: 200, url: 'https://login.microsoftonline.com/', body: null })
    const { d, downloads } = deps({ bbFetch: lost })
    const result = await readDocuments(snap, want(), d)
    expect(result.stopped).toMatch(/not logged in/)
    expect(downloads).toHaveLength(0)
  })

  it('stops after a fatal dashboard error', async () => {
    const { d, downloads } = deps({ upload: async () => ({ ok: false, error: 'The dashboard rejected the sync token.', fatal: true }) })
    const result = await readDocuments(snap, want(), d)
    expect(result.stopped).toMatch(/stopped accepting/)
    expect(downloads).toHaveLength(1)
  })

  it(`downloads at most ${MAX_DOCUMENTS_PER_SYNC} files per sync`, async () => {
    const many = Array.from({ length: MAX_DOCUMENTS_PER_SYNC + 2 }, (_, i) => ({ id: `_${i}_1`, fileName: `${i}.pdf`, mimeType: 'application/pdf' }))
    const { d, downloads } = deps({ bbFetch: bbFetch({ _5_1: many }) })
    const result = await readDocuments(snap, want(), d)
    expect(downloads).toHaveLength(MAX_DOCUMENTS_PER_SYNC)
    expect(result.skipped).toHaveLength(2)
  })
})

describe('downloadLimited', () => {
  const respond = (body: BodyInit | null, init: ResponseInit & { url?: string } = {}) => {
    const res = new Response(body, init)
    Object.defineProperty(res, 'url', { value: init.url ?? 'https://prod01.files.blackboard.com/abc/1?sig=x' })
    return async () => res
  }

  it('returns the bytes when the redirect chain ends on Blackboard', async () => {
    const result = await downloadLimited(respond(PDF, { headers: { 'content-type': 'application/pdf' } }), 'u', 100)
    expect(result).toEqual({ ok: true, bytes: PDF })
  })

  it('skips by Content-Length and while streaming', async () => {
    const declared = await downloadLimited(respond(PDF, { headers: { 'content-length': '500' } }), 'u', 100)
    expect(declared).toMatchObject({ ok: false, tooLarge: true })
    const streamed = await downloadLimited(respond(new Uint8Array(200)), 'u', 100)
    expect(streamed).toMatchObject({ ok: false, tooLarge: true })
  })

  it('treats a login page or SSO redirect as login needed', async () => {
    const html = await downloadLimited(respond('<html>', { headers: { 'content-type': 'text/html' } }), 'u', 100)
    expect(html).toMatchObject({ ok: false, loginRequired: true })
    const sso = await downloadLimited(respond('x', { url: 'https://login.microsoftonline.com/' }), 'u', 100)
    expect(sso).toMatchObject({ ok: false, loginRequired: true })
  })

  it('reports a redirect it could not follow as a failure', async () => {
    const result = await downloadLimited(async () => Promise.reject(new TypeError('Failed to fetch')), 'u', 100)
    expect(result).toEqual({ ok: false, reason: 'download failed (Failed to fetch)' })
  })
})

describe('postToDashboard', () => {
  const accept = (b: unknown): b is { counts: object } => !!b && typeof b === 'object' && 'counts' in b
  const opts = { accept, tooLarge: 'Snapshot too large for the dashboard' }
  const json = (status: number, body: unknown) => async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  it('sends gzip with the right content type and records sizes', async () => {
    let seen: RequestInit | undefined
    const fetchFn = async (_url: string, init: RequestInit) => {
      seen = init
      return new Response(JSON.stringify({ counts: { courses: 1 } }), { headers: { 'content-type': 'application/json' } })
    }
    const result = await postToDashboard(fetchFn, 'https://d/api', 'tok', { big: 'a'.repeat(5000) }, opts)
    expect(result).toMatchObject({ ok: true, body: { counts: { courses: 1 } }, bytes: { gzip: true } })
    expect((seen!.headers as Record<string, string>)['Content-Type']).toBe('application/gzip')
    expect(seen!.method).toBe('POST')
    if (result.ok) expect(result.bytes.sent).toBeLessThan(result.bytes.raw)
  })

  it('never POSTs to a Blackboard host', async () => {
    let called = false
    const fetchFn = async () => {
      called = true
      return new Response('{}')
    }
    for (const url of [
      'https://blackboard.durham.ac.uk/api/blackboard/sync',
      'https://alt-1.blackboard.com/x',
      'https://blackboard.durham.ac.uk./api/blackboard/sync',
      'https://BlackBoard.Durham.ac.uk/api/blackboard/sync',
    ]) {
      expect(await postToDashboard(fetchFn, url, 't', {}, opts)).toMatchObject({ ok: false, fatal: true })
    }
    expect(called).toBe(false)
  })

  it('maps 401, 413, network errors, HTML pages and server errors', async () => {
    expect(await postToDashboard(json(401, { error: 'unauthenticated' }), 'u', 't', {}, opts)).toMatchObject({ ok: false, fatal: true, error: 'The dashboard rejected the sync token.' })
    expect(await postToDashboard(async () => new Response('', { status: 413 }), 'u', 't', {}, opts)).toMatchObject({ ok: false, fatal: false, error: 'Snapshot too large for the dashboard' })
    expect(await postToDashboard(async () => Promise.reject(new TypeError('Failed to fetch')), 'u', 't', {}, opts)).toMatchObject({ ok: false, fatal: true, error: expect.stringMatching(/^Couldn't reach the dashboard \(Failed to fetch\)/) })
    const html = async () => new Response('<html>Log in</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    expect(await postToDashboard(html, 'u', 't', {}, opts)).toMatchObject({ ok: false, fatal: true, error: expect.stringMatching(/address is probably wrong/) })
    expect(await postToDashboard(json(500, { error: 'sync_failed', detail: 'function not found' }), 'u', 't', {}, opts)).toMatchObject({ ok: false, fatal: false, error: 'The dashboard returned 500: function not found.' })
  })
})
