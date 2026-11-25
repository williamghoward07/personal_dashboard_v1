/**
 * Wire contract between the Chrome extension and the dashboard's
 * `/api/blackboard/*` routes. Types and constants only: this file is bundled
 * into the extension, so no `server-only`, Next or Supabase imports.
 */

/** A gzipped JSON body is sent with this content type; plain JSON still works. */
export const GZIP_CONTENT_TYPE = 'application/gzip'

export const DOCUMENT_PATH = '/api/blackboard/document'

/** Files larger than this are skipped, never downloaded in full. */
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024

/** Extracted text is cut to this length before upload (matches the DB check). */
export const DOCUMENT_MAX_CHARS = 500_000

/** Only these are read. Slide decks (pptx) stay links. */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

/** Separates pages in extracted text. */
export const PAGE_BREAK = '\f'

/**
 * A content item whose attached documents the dashboard wants read
 * (handbooks and assessment briefs). `known` maps a document's `bb_id`
 * (attachment id) to the version already stored, so unchanged files are skipped.
 */
export interface WantedDocument {
  course_bb_id: string
  content_bb_id: string
  known: Record<string, string>
}

/** 200 response of `POST /api/blackboard/sync`. */
export interface SyncResponse {
  counts: Record<string, unknown>
  wanted?: WantedDocument[]
}

/** Body of `POST /api/blackboard/document`: extracted text only, never file bytes. */
export interface DocumentUpload {
  course_bb_id: string
  content_bb_id: string
  /** Attachment id. */
  bb_id: string
  file_name: string
  mime_type: string
  byte_size: number | null
  /** The content item's `modified` timestamp; '' when unknown. */
  version: string
  page_count: number | null
  /** Pages joined with PAGE_BREAK, at most DOCUMENT_MAX_CHARS. */
  text: string
}

/** 200 response of `POST /api/blackboard/document`. */
export interface DocumentResponse {
  ok: true
}
