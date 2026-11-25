import { describe, expect, it } from 'vitest'
import { BB_ORIGIN } from './client'
import { HANDBOOK_PATTERN, handbookWords, isHandbookCandidate, isReadableDocument, parseDocumentBody, wantedDocuments } from './documents'
import type { BbContentLink } from './links'
import type { BbContentRow } from './normalise'
import { DOCUMENT_MAX_CHARS } from './wire'

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const url = (id: string) => `${BB_ORIGIN}/ultra/courses/_100_1/outline/file/${id}`

function file(label: string, mime?: string, id = '_1_1'): BbContentLink {
  const link: BbContentLink = { href: url(id), label, kind: mime === PPTX || /\.pptx?$/i.test(label) ? 'slides' : 'file' }
  if (mime) link.mime = mime
  return link
}

function row(overrides: Partial<BbContentRow> = {}): BbContentRow {
  return {
    bb_id: '_1_1',
    course_bb_id: '_100_1',
    parent_bb_id: null,
    title: 'Something',
    kind: 'file',
    available_from: null,
    path: [],
    week_label: null,
    url: url('_1_1'),
    body_text: null,
    links: [],
    ...overrides,
  }
}

describe('HANDBOOK_PATTERN', () => {
  it('matches handbook and assessment wording', () => {
    for (const text of ['Module Handbook', 'Module guide 2026', 'Start Here', 'Summative essay', 'Assessment brief', 'Exam information', 'Coursework deadlines']) {
      expect(HANDBOOK_PATTERN.test(text)).toBe(true)
    }
    expect(HANDBOOK_PATTERN.test('Week 12: Introduction Lecture')).toBe(false)
  })
})

describe('isHandbookCandidate', () => {
  it('accepts a pdf or docx whose title, folder or file name looks like a handbook or brief', () => {
    expect(isHandbookCandidate(row({ title: 'GEOG1241 Module Handbook', links: [file('handbook.pdf', PDF)] }))).toBe(true)
    expect(isHandbookCandidate(row({ title: 'Read me', path: ['Assignments and Feedback'], links: [file('x.docx', DOCX)] }))).toBe(true)
    expect(isHandbookCandidate(row({ title: 'Read me', links: [file('Summative_Essay_Brief.docx', DOCX)] }))).toBe(true)
    // A document item with an embedded docx brief (no mime, by extension, on Blackboard).
    expect(isHandbookCandidate(row({ kind: 'document', title: 'Formative task', links: [file('task.docx')] }))).toBe(true)
  })

  it('rejects slides, items without a readable file, and unrelated titles', () => {
    expect(isHandbookCandidate(row({ title: 'Assessment briefing', links: [file('Assessment briefing.pptx', PPTX)] }))).toBe(false)
    expect(isHandbookCandidate(row({ title: 'Module handbook', links: [] }))).toBe(false)
    expect(isHandbookCandidate(row({ title: 'Lecture 3 notes', links: [file('notes.pdf', PDF)] }))).toBe(false)
    expect(isHandbookCandidate(row({ kind: 'folder', title: 'Assessment', links: [file('brief.pdf', PDF)] }))).toBe(false)
    // An off-Blackboard pdf can't be read by the extension.
    expect(
      isHandbookCandidate(row({ kind: 'document', title: 'Exam', links: [{ href: 'https://www.dur.ac.uk/exam.pdf', label: 'exam.pdf', kind: 'file' }] })),
    ).toBe(false)
    expect(isHandbookCandidate(row({ title: 'Handbook', links: [file('handbook.xlsx', 'application/vnd.ms-excel')] }))).toBe(false)
  })
})

describe('readable documents (same rules as the extension)', () => {
  it('normalises the mime and accepts generic mimes by file name', () => {
    expect(isReadableDocument(file('Brief.pdf', 'application/pdf; charset=binary'))).toBe(true)
    expect(isReadableDocument(file('Brief.pdf', 'Application/PDF'))).toBe(true)
    expect(isReadableDocument(file('Brief.pdf', 'application/octet-stream'))).toBe(true)
    expect(isReadableDocument(file('Brief.docx', 'binary/octet-stream'))).toBe(true)
    expect(isReadableDocument(file('Brief.docx', ''))).toBe(true)
    expect(isReadableDocument(file('Brief.zip', 'application/octet-stream'))).toBe(false)
    expect(isReadableDocument(file('Brief.pdf', 'application/vnd.ms-excel'))).toBe(false)
    // pptx never qualifies, whatever the mime says.
    expect(isReadableDocument(file('Slides.pptx', 'application/octet-stream'))).toBe(false)
    expect(isReadableDocument(file('Slides.pptx', PPTX))).toBe(false)
    expect(isReadableDocument({ href: url('_1_1'), label: 'Deck.pdf', kind: 'slides', mime: PDF })).toBe(false)
  })

  it('wants an x-bb-file handbook with a generic mime', () => {
    expect(isHandbookCandidate(row({ title: 'Module Handbook', links: [file('handbook.pdf', 'application/octet-stream')] }))).toBe(true)
  })

  it('splits camelCase and digits before matching', () => {
    expect(handbookWords('ModuleHandbook2026.pdf')).toBe('Module Handbook 2026 pdf')
    expect(handbookWords('GEOG1241AssessmentBrief')).toBe('GEOG 1241 Assessment Brief')
    expect(isHandbookCandidate(row({ title: 'Read me', links: [file('ModuleHandbook2026.pdf', PDF)] }))).toBe(true)
    expect(isHandbookCandidate(row({ title: 'SummativeBrief', links: [file('x.docx', DOCX)] }))).toBe(true)
  })
})

describe('wantedDocuments', () => {
  const handbook = (id: string, depth: number, course = '_100_1') =>
    row({ bb_id: id, course_bb_id: course, title: `Handbook ${id}`, path: Array(depth).fill('Folder'), links: [file('h.pdf', PDF, id)] })

  it('lists candidates and explicit "read with AI" picks with their known versions', () => {
    const rows = [handbook('_1_1', 0), row({ bb_id: '_2_1', title: 'Lecture 2' }), row({ bb_id: '_3_1', title: 'Week 3 reading' })]
    const known = new Map([['_1_1', { _att_1: '2026-10-01T00:00:00.000Z' }]])
    expect(wantedDocuments(rows, { readWithAi: new Set(['_3_1']), known })).toEqual([
      { course_bb_id: '_100_1', content_bb_id: '_3_1', known: {} },
      { course_bb_id: '_100_1', content_bb_id: '_1_1', known: { _att_1: '2026-10-01T00:00:00.000Z' } },
    ])
  })

  it('puts own-title and file-name matches ahead of folder-only matches before capping', () => {
    const underFolder = (id: string) =>
      row({ bb_id: id, title: `Week ${id} reading`, path: ['Assignments and Feedback'], links: [file(`${id}.pdf`, PDF, id)] })
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => underFolder(`_f${i}_1`)),
      row({ bb_id: '_deep_1', title: 'Notes', path: ['A', 'B', 'C'], links: [file('ModuleHandbook2026.pdf', PDF, '_deep_1')] }),
      row({ bb_id: '_hb_1', title: 'Module handbook', path: ['Start Here', 'Info'], links: [file('h.pdf', PDF, '_hb_1')] }),
      row({ bb_id: '_pick_1', title: 'Week 5 notes', path: ['A', 'B', 'C', 'D'] }),
    ]
    const wanted = wantedDocuments(rows, { readWithAi: new Set(['_pick_1']), known: new Map() }).map((w) => w.content_bb_id)
    expect(wanted).toHaveLength(10)
    expect(wanted.slice(0, 3)).toEqual(['_pick_1', '_hb_1', '_deep_1'])
    expect(wanted.slice(3)).toEqual(['_f0_1', '_f1_1', '_f2_1', '_f3_1', '_f4_1', '_f5_1', '_f6_1'])
  })

  it('caps each course, keeping explicit picks first, then shallower items', () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => handbook(`_d${i}_1`, 3)),
      handbook('_top_1', 0),
      row({ bb_id: '_pick_1', title: 'Week 5 notes', path: ['A', 'B', 'C', 'D'] }),
      handbook('_other_1', 2, '_200_1'),
    ]
    const wanted = wantedDocuments(rows, { readWithAi: new Set(['_pick_1']), known: new Map() })
    const first = wanted.filter((w) => w.course_bb_id === '_100_1').map((w) => w.content_bb_id)
    expect(first).toHaveLength(10)
    expect(first.slice(0, 2)).toEqual(['_pick_1', '_top_1'])
    expect(first.slice(2)).toEqual(['_d0_1', '_d1_1', '_d2_1', '_d3_1', '_d4_1', '_d5_1', '_d6_1', '_d7_1'])
    expect(wanted.filter((w) => w.course_bb_id === '_200_1')).toHaveLength(1)
    expect(wantedDocuments(rows, { readWithAi: new Set(), known: new Map(), perCourseCap: 2 })).toHaveLength(3)
  })
})

describe('parseDocumentBody', () => {
  const valid = {
    course_bb_id: '_100_1',
    content_bb_id: '_1_1',
    bb_id: '_att_1',
    file_name: 'Module Handbook.pdf',
    mime_type: PDF,
    byte_size: 123456,
    version: '2026-10-01T00:00:00.000Z',
    page_count: 12,
    text: 'Page one\fPage two',
  }

  it('accepts a valid upload', () => {
    expect(parseDocumentBody(valid)).toEqual({ ok: true, value: valid })
    const nulls = parseDocumentBody({ ...valid, byte_size: null, page_count: undefined, version: '', mime_type: DOCX })
    expect(nulls).toEqual({ ok: true, value: { ...valid, byte_size: null, page_count: null, version: '', mime_type: DOCX } })
  })

  it('truncates long text and strips NUL characters', () => {
    const long = parseDocumentBody({ ...valid, text: `a\u0000${'x'.repeat(DOCUMENT_MAX_CHARS + 10)}` })
    expect(long.ok && long.value.text.length).toBe(DOCUMENT_MAX_CHARS)
    expect(long.ok && long.value.text.startsWith('ax')).toBe(true)
  })

  it('rejects junk', () => {
    const bad = (body: unknown) => parseDocumentBody(body).ok
    expect(bad(null)).toBe(false)
    expect(bad([valid])).toBe(false)
    expect(bad({ ...valid, bb_id: '' })).toBe(false)
    expect(bad({ ...valid, content_bb_id: 5 })).toBe(false)
    expect(bad({ ...valid, file_name: '  ' })).toBe(false)
    expect(bad({ ...valid, mime_type: PPTX })).toBe(false)
    expect(bad({ ...valid, text: '   ' })).toBe(false)
    expect(bad({ ...valid, text: undefined })).toBe(false)
    expect(bad({ ...valid, byte_size: Number.NaN })).toBe(false)
    expect(bad({ ...valid, page_count: Infinity })).toBe(false)
    expect(bad({ ...valid, page_count: '3' })).toBe(false)
    expect(parseDocumentBody({ ...valid, mime_type: 'text/html' })).toEqual({ ok: false, error: 'mime_type not supported' })
  })
})
