// After a successful upload: read the text of the handbooks and assessment
// briefs the dashboard asked for (`wanted`), and send only that text. One
// document failing never fails the sync; it is recorded and the next one is
// tried. Only counts and file names are kept (in the last-run record), never
// bytes or text. Every dependency is injected, so this has no chrome.* calls.
import {
  BbLoginRequiredError,
  attachmentDownloadUrl,
  getAttachments,
  type BbAttachment,
  type BbFetch,
  type BbSnapshot,
} from '@/lib/blackboard/client'
import {
  DOCUMENT_MAX_CHARS,
  DOCUMENT_MIME_TYPES,
  type DocumentUpload,
  type WantedDocument,
} from '@/lib/blackboard/wire'
import type { DownloadResult } from './download'

/** At most this many files are downloaded per sync. */
export const MAX_DOCUMENTS_PER_SYNC = 30
/** Kept in the last-run record per list, so storage stays small. */
const MAX_NOTES = 40

export type DocumentKind = 'pdf' | 'docx'

export interface DocumentNote {
  fileName: string
  reason: string
}

export interface DocumentsResult {
  /** Content items the dashboard asked about. */
  wanted: number
  /** Text extracted and saved by the dashboard. */
  read: number
  /** Same version as the dashboard already has. */
  unchanged: number
  skipped: DocumentNote[]
  failed: DocumentNote[]
  /** Why the rest was not tried, when the run stopped early. */
  stopped?: string
  /**
   * Files given up on at this version (no text, too big, unreadable): attachment
   * id -> version and reason. Persist these and pass them back as `deps.settled`
   * so they are not downloaded again until the item changes. Ids and reasons only.
   */
  settled: Record<string, { version: string; reason: string }>
}

export interface DocumentDeps {
  /** JSON GETs to Blackboard (session cookie, gentle delay already applied). */
  bbFetch: BbFetch
  download: (url: string) => Promise<DownloadResult>
  extract: (kind: DocumentKind, bytes: Uint8Array) => Promise<{ text: string; pageCount: number | null }>
  /** POST to the dashboard. `fatal` stops the run (unreachable, bad token, wrong address). */
  upload: (doc: DocumentUpload) => Promise<{ ok: true } | { ok: false; error: string; fatal: boolean }>
  /** Pause before each download, to stay gentle on Blackboard. */
  pause: () => Promise<void>
  /** Attachment id -> version already given up on (from an earlier run's `settled`). */
  settled?: Record<string, string>
  onProgress?: (done: number, total: number) => void
}

const GENERIC_MIME = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-download', 'application/force-download', 'application/download'])

/** pdf / docx by mime type, or by file name when the mime type says nothing. Anything else (pptx) is never read. */
export function documentKind(attachment: Pick<BbAttachment, 'fileName' | 'mimeType'>): DocumentKind | null {
  const mime = attachment.mimeType.split(';')[0].trim().toLowerCase()
  if (mime === DOCUMENT_MIME_TYPES[0]) return 'pdf'
  if (mime === DOCUMENT_MIME_TYPES[1]) return 'docx'
  if (!GENERIC_MIME.has(mime)) return null
  const name = attachment.fileName.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  return null
}

/** The file's real type from its first bytes; the mime type on Blackboard can be wrong. */
export function sniffKind(bytes: Uint8Array): DocumentKind | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf' // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'docx' // PK\3\4
  return null
}

/** The content item's `modified` from the snapshot: the document's version. '' when unknown. */
export function contentVersion(snap: BbSnapshot, courseBbId: string, contentBbId: string): string {
  const course = snap.courses.find((c) => c.bbId === courseBbId)
  const item = course?.contents.find((c) => c.id === contentBbId)
  return typeof item?.modified === 'string' ? item.modified : ''
}

function cutText(text: string): string {
  if (text.length <= DOCUMENT_MAX_CHARS) return text
  let cut = text.slice(0, DOCUMENT_MAX_CHARS)
  // Don't end on half a surrogate pair.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
  return cut
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export async function readDocuments(snap: BbSnapshot, wanted: WantedDocument[], deps: DocumentDeps): Promise<DocumentsResult> {
  const result: DocumentsResult = { wanted: wanted.length, read: 0, unchanged: 0, skipped: [], failed: [], settled: {} }
  const note = (list: DocumentNote[], fileName: string, reason: string) => {
    if (list.length < MAX_NOTES) list.push({ fileName, reason })
  }
  let downloads = 0

  for (const [index, want] of wanted.entries()) {
    deps.onProgress?.(index, wanted.length)
    let attachments: BbAttachment[]
    try {
      attachments = await getAttachments(deps.bbFetch, want.course_bb_id, want.content_bb_id)
    } catch (err) {
      if (err instanceof BbLoginRequiredError) {
        result.stopped = 'The background worker is not logged in to Blackboard, so documents could not be read.'
        break
      }
      note(result.failed, `item ${want.content_bb_id}`, `couldn't list its files (${errorText(err)})`)
      continue
    }
    const version = contentVersion(snap, want.course_bb_id, want.content_bb_id)

    for (const attachment of attachments) {
      const name = attachment.fileName || attachment.id
      const kind = documentKind(attachment)
      if (!kind) {
        note(result.skipped, name, 'not a PDF or Word file')
        continue
      }
      if (Object.hasOwn(want.known, attachment.id) && want.known[attachment.id] === version) {
        result.unchanged++
        continue
      }
      if (deps.settled && Object.hasOwn(deps.settled, attachment.id) && deps.settled[attachment.id] === version) {
        result.unchanged++
        continue
      }
      if (downloads >= MAX_DOCUMENTS_PER_SYNC) {
        note(result.skipped, name, `over the ${MAX_DOCUMENTS_PER_SYNC}-per-sync limit (next sync)`)
        continue
      }
      downloads++

      await deps.pause()
      const file = await deps.download(attachmentDownloadUrl(want.course_bb_id, want.content_bb_id, attachment.id))
      if (!file.ok) {
        if (file.tooLarge) {
          note(result.skipped, name, file.reason)
          result.settled[attachment.id] = { version, reason: file.reason }
        }
        else note(result.failed, name, file.reason)
        if (file.loginRequired) {
          result.stopped = 'Blackboard asked for a login while downloading, so the rest were not tried.'
          return result
        }
        continue
      }

      const actual = sniffKind(file.bytes) ?? kind
      let extracted: { text: string; pageCount: number | null }
      try {
        extracted = await deps.extract(actual, file.bytes)
      } catch (err) {
        const reason = `couldn't read the ${actual === 'pdf' ? 'PDF' : 'Word file'} (${errorText(err)})`
        note(result.failed, name, reason)
        result.settled[attachment.id] = { version, reason }
        continue
      }
      const text = cutText(extracted.text)
      if (!text.replace(/\s/g, '')) {
        note(result.skipped, name, 'no text (a scanned PDF?)')
        result.settled[attachment.id] = { version, reason: 'no text' }
        continue
      }

      const sent = await deps.upload({
        course_bb_id: want.course_bb_id,
        content_bb_id: want.content_bb_id,
        bb_id: attachment.id,
        file_name: attachment.fileName,
        mime_type: actual === 'pdf' ? DOCUMENT_MIME_TYPES[0] : DOCUMENT_MIME_TYPES[1],
        byte_size: file.bytes.byteLength,
        version,
        page_count: extracted.pageCount,
        text,
      })
      if (sent.ok) {
        result.read++
        continue
      }
      note(result.failed, name, sent.error)
      if (sent.fatal) {
        result.stopped = 'The dashboard stopped accepting documents, so the rest were not tried.'
        return result
      }
    }
  }
  deps.onProgress?.(wanted.length, wanted.length)
  return result
}
