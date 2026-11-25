// Which attached documents the dashboard wants read, and validation of the
// extension's document upload. Pure: no Next, Supabase or server-only
// imports (bundled into the extension).
//
// Only handbooks and assessment briefs are read (pdf / docx, as text
// extracted in the browser). Slide decks stay links. Anything the user
// marked "read with AI" is wanted as well.

import { BB_ORIGIN } from './client'
import { cleanText, type BbContentLink } from './links'
import type { BbContentRow } from './normalise'
import { DOCUMENT_MAX_CHARS, DOCUMENT_MIME_TYPES, type DocumentUpload, type WantedDocument } from './wire'

/** Titles, folder names and file names that mark a handbook or assessment brief. */
export const HANDBOOK_PATTERN =
  /\b(?:handbooks?|module (?:guide|information|outline|overview|booklet)s?|start here|assessments?|assignments?|summative|formative|briefs?|exams?|examinations?|coursework|feedback|deadlines?)\b/i

/** Most documents wanted per course in one sync. */
export const WANTED_PER_COURSE = 10

const READABLE_EXT = /\.(pdf|docx)$/i

/** "Module_Handbook-2026.pdf" and "ModuleHandbook2026.pdf" → "Module Handbook 2026 pdf". */
export function handbookWords(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[_\-.+]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function matchesHandbook(text: string): boolean {
  return HANDBOOK_PATTERN.test(handbookWords(text))
}

function onBlackboard(href: string): boolean {
  try {
    return new URL(href).origin === BB_ORIGIN
  } catch {
    return false
  }
}

/** Mime types that say nothing about the file; the name decides (same list as the extension's `documentKind`). */
const GENERIC_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-download', 'application/force-download', 'application/download'])

/** A link to a Blackboard-held pdf or docx (never pptx). */
export function isReadableDocument(link: BbContentLink): boolean {
  if (link.kind === 'slides') return false
  const mime = (link.mime ?? '').split(';')[0].trim().toLowerCase()
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)) return true
  if (!GENERIC_MIME.has(mime)) return false
  return link.kind === 'file' && READABLE_EXT.test(link.label.trim()) && onBlackboard(link.href)
}

/**
 * A file or document item carrying at least one pdf/docx whose title, folder
 * path or file name looks like a handbook or assessment brief.
 */
export function isHandbookCandidate(row: Pick<BbContentRow, 'title' | 'path' | 'kind' | 'links'>): boolean {
  if (row.kind !== 'file' && row.kind !== 'document') return false
  const docs = row.links.filter(isReadableDocument)
  if (docs.length === 0) return false
  return matchesHandbook(row.title) || row.path.some(matchesHandbook) || docs.some((d) => matchesHandbook(d.label))
}

export interface WantedOptions {
  /** Content bb_ids the user marked "read with AI" (bb_content_ai.read_with_ai). */
  readWithAi: Set<string>
  /** Content bb_id → { attachment bb_id → stored version }. */
  known: Map<string, Record<string, string>>
  perCourseCap?: number
}

/**
 * Handbook candidates plus anything marked "read with AI", at most
 * `perCourseCap` per course. Order before the cap: explicit picks, then
 * items whose own title or file name matches, then folder-only matches
 * (everything under "Assignments and Feedback"), then shallower items.
 */
export function wantedDocuments(
  contentRows: Pick<BbContentRow, 'bb_id' | 'course_bb_id' | 'title' | 'path' | 'kind' | 'links'>[],
  opts: WantedOptions,
): WantedDocument[] {
  const cap = opts.perCourseCap ?? WANTED_PER_COURSE
  const byCourse = new Map<string, { row: (typeof contentRows)[number]; rank: number; index: number }[]>()
  const seen = new Set<string>()
  contentRows.forEach((row, index) => {
    if (seen.has(row.bb_id)) return
    const explicit = opts.readWithAi.has(row.bb_id)
    if (!explicit && !isHandbookCandidate(row)) return
    seen.add(row.bb_id)
    const list = byCourse.get(row.course_bb_id) ?? []
    // 0 = explicit, 1 = own title / file name matches, 2 = folder path only.
    const own = matchesHandbook(row.title) || row.links.some((l) => isReadableDocument(l) && matchesHandbook(l.label))
    list.push({ row, rank: explicit ? 0 : own ? 1 : 2, index })
    byCourse.set(row.course_bb_id, list)
  })
  const out: WantedDocument[] = []
  for (const list of byCourse.values()) {
    list.sort((a, b) => a.rank - b.rank || a.row.path.length - b.row.path.length || a.index - b.index)
    for (const { row } of list.slice(0, Math.max(0, cap))) {
      out.push({ course_bb_id: row.course_bb_id, content_bb_id: row.bb_id, known: { ...(opts.known.get(row.bb_id) ?? {}) } })
    }
  }
  return out
}

// ------------------------------------------------------------ validation --

const MAX_ID = 200
const MAX_FILE_NAME = 500
const MAX_VERSION = 100

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isObj(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function count(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : undefined
}

/** The extension's `POST /api/blackboard/document` body (wire.ts `DocumentUpload`). */
export function parseDocumentBody(json: unknown): ParseResult<DocumentUpload> {
  if (!isObj(json)) return { ok: false, error: 'body must be an object' }
  const ids: Record<'course_bb_id' | 'content_bb_id' | 'bb_id', string> = { course_bb_id: '', content_bb_id: '', bb_id: '' }
  for (const key of ['course_bb_id', 'content_bb_id', 'bb_id'] as const) {
    const value = json[key]
    if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_ID) return { ok: false, error: `${key} is required` }
    ids[key] = value.trim()
  }
  const fileName = typeof json.file_name === 'string' ? cleanText(json.file_name, MAX_FILE_NAME).trim() : ''
  if (!fileName) return { ok: false, error: 'file_name is required' }
  const mime = typeof json.mime_type === 'string' ? json.mime_type.trim().toLowerCase() : ''
  if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)) return { ok: false, error: 'mime_type not supported' }
  const rawVersion = json.version ?? ''
  if (typeof rawVersion !== 'string' || rawVersion.length > MAX_VERSION) return { ok: false, error: 'version must be a string' }
  const version = cleanText(rawVersion)
  const byteSize = count(json.byte_size)
  if (byteSize === undefined) return { ok: false, error: 'byte_size must be a whole number or null' }
  const pageCount = count(json.page_count)
  if (pageCount === undefined) return { ok: false, error: 'page_count must be a whole number or null' }
  if (typeof json.text !== 'string') return { ok: false, error: 'text is required' }
  const text = cleanText(json.text, DOCUMENT_MAX_CHARS)
  if (text.trim() === '') return { ok: false, error: 'text is empty' }
  return {
    ok: true,
    value: { ...ids, file_name: fileName, mime_type: mime, byte_size: byteSize, version, page_count: pageCount, text },
  }
}
