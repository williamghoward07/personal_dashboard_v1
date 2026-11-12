// Plain text from a .docx (module handbooks, assessment briefs), with no
// dependencies so it can be bundled into the Chrome extension. Reads the zip
// central directory, inflates `word/document.xml` with DecompressionStream,
// and keeps only the words: paragraphs become lines, table rows become one
// line with cells joined by " | " (assessment tables carry the dates).
// Pure: no `server-only`, Next, Supabase or `chrome.*` imports.

const DOCUMENT_XML = 'word/document.xml'

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

/** Most bytes `word/document.xml` may inflate to (a real handbook's is a few MB). Zip-bomb guard. */
export const DOCX_MAX_INFLATED_BYTES = 50 * 1024 * 1024

export class DocxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocxError'
  }
}

export async function docxToText(bytes: Uint8Array): Promise<string> {
  const xml = new TextDecoder('utf-8').decode(await readZipEntry(bytes, DOCUMENT_XML))
  return documentXmlToText(xml)
}

// ---------- zip ----------

interface ZipEntry {
  method: number
  compressedSize: number
  uncompressedSize: number
  localOffset: number
}

/** The bytes of one file in the zip, inflated. */
export async function readZipEntry(bytes: Uint8Array, name: string, maxBytes = DOCX_MAX_INFLATED_BYTES): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entry = findEntry(bytes, view, name)
  if (!entry) throw new DocxError(`Not a Word document: ${name} is missing`)
  if (entry.uncompressedSize > maxBytes) throw tooLarge(maxBytes)

  const local = entry.localOffset
  need(bytes, local, 30)
  if (view.getUint32(local, true) !== SIG_LOCAL) throw new DocxError('Damaged zip: bad local file header')
  // The local header's own name/extra lengths can differ from the central directory's.
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
  need(bytes, start, entry.compressedSize)
  const data = bytes.subarray(start, start + entry.compressedSize)

  if (entry.method === 0) {
    if (data.byteLength > maxBytes) throw tooLarge(maxBytes)
    return data
  }
  if (entry.method === 8) return inflateRaw(data, maxBytes)
  throw new DocxError(`Unsupported zip compression method ${entry.method}`)
}

function findEntry(bytes: Uint8Array, view: DataView, name: string): ZipEntry | null {
  const eocd = findEndOfCentralDirectory(bytes, view)
  const count = view.getUint16(eocd + 10, true)
  const size = view.getUint32(eocd + 12, true)
  let offset = view.getUint32(eocd + 16, true)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw new DocxError('ZIP64 files are not supported')
  need(bytes, offset, size)

  const decoder = new TextDecoder('utf-8')
  for (let i = 0; i < count; i++) {
    need(bytes, offset, 46)
    if (view.getUint32(offset, true) !== SIG_CENTRAL) throw new DocxError('Damaged zip: bad central directory')
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    need(bytes, offset + 46, nameLength)
    const entryName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (entryName === name) {
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
        throw new DocxError('ZIP64 files are not supported')
      }
      return { method, compressedSize, uncompressedSize, localOffset }
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  return null
}

/** The end-of-central-directory record sits in the last 22 bytes + up to 64 KB of comment. */
function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
  const lowest = Math.max(0, bytes.length - 22 - 0xffff)
  for (let i = bytes.length - 22; i >= lowest; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i
  }
  throw new DocxError('Not a zip file, or it was cut short')
}

function need(bytes: Uint8Array, offset: number, length: number) {
  if (offset < 0 || offset + length > bytes.length) throw new DocxError('Damaged zip: it was cut short')
}

const tooLarge = (maxBytes: number) =>
  new DocxError(`The Word file's text is larger than ${Math.round(maxBytes / 1024 / 1024)} MB once unpacked, so it was not read`)

/**
 * Inflates chunk by chunk and gives up once `maxBytes` have come out: the
 * central directory's size can lie, and 1 MB of deflate can unpack to 1 GB.
 */
async function inflateRaw(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let total = 0
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    reader = (stream as ReadableStream<Uint8Array>).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw tooLarge(maxBytes)
      }
      chunks.push(value)
    }
  } catch (err) {
    if (err instanceof DocxError) throw err
    throw new DocxError(`Damaged zip: could not inflate (${err instanceof Error ? err.message : String(err)})`)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

// ---------- WordprocessingML ----------

interface TableFrame {
  /** Finished cells of the current row. */
  cells: string[]
  /** Paragraphs of the current cell. */
  cellParagraphs: string[]
  /** Lines of finished rows. */
  rows: string[]
}

/**
 * `word/document.xml` → text. Only `<w:t>` text counts (field codes and
 * deleted text are dropped); `<w:tab/>` → tab, `<w:br/>`/`<w:cr/>` → newline.
 * Text-box fallbacks (`mc:Fallback`) repeat their `mc:Choice`, so they are skipped.
 */
export function documentXmlToText(xml: string): string {
  const lines: string[] = []
  const tables: TableFrame[] = []
  let paragraph = ''
  let inText = false
  let runDepth = 0
  let fallbackDepth = 0

  const endParagraph = () => {
    const table = tables.at(-1)
    if (table) table.cellParagraphs.push(paragraph.trim())
    else lines.push(paragraph.replace(/\s+$/, ''))
    paragraph = ''
  }

  const tokens = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)/g
  for (const match of xml.matchAll(tokens)) {
    const [, closing, tag, , selfClosing, cdata, text] = match
    if (text !== undefined || cdata !== undefined) {
      if (inText && fallbackDepth === 0) paragraph += cdata ?? decodeEntities(text!)
      continue
    }
    if (!tag) continue // comment or processing instruction

    if (tag === 'mc:Fallback') {
      if (selfClosing) continue
      fallbackDepth += closing ? -1 : 1
      continue
    }
    if (fallbackDepth > 0) continue

    if (closing) {
      switch (tag) {
        case 'w:t':
          inText = false
          break
        case 'w:r':
          runDepth = Math.max(0, runDepth - 1)
          break
        case 'w:p':
          endParagraph()
          break
        case 'w:tc': {
          const table = tables.at(-1)
          if (table) {
            // One row stays on one line, so breaks inside a cell become spaces.
            table.cells.push(table.cellParagraphs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
            table.cellParagraphs = []
          }
          break
        }
        case 'w:tr': {
          const table = tables.at(-1)
          if (table) {
            if (table.cells.some(Boolean)) table.rows.push(table.cells.join(' | '))
            table.cells = []
          }
          break
        }
        case 'w:tbl': {
          const table = tables.pop()
          if (!table) break
          const outer = tables.at(-1)
          // A table inside a cell joins that cell's text.
          if (outer) outer.cellParagraphs.push(table.rows.join('; '))
          else lines.push(...table.rows)
          break
        }
      }
      continue
    }

    switch (tag) {
      case 'w:t':
        if (!selfClosing) inText = true
        break
      case 'w:r':
        if (!selfClosing) runDepth++
        break
      case 'w:tab':
        // Tab stops in paragraph properties (`w:tabs`) are not text.
        if (runDepth > 0) paragraph += '\t'
        break
      case 'w:br':
      case 'w:cr':
        if (runDepth > 0) paragraph += '\n'
        break
      case 'w:p':
        if (selfClosing) endParagraph()
        break
      case 'w:tbl':
        if (!selfClosing) tables.push({ cells: [], cellParagraphs: [], rows: [] })
        break
    }
  }
  if (paragraph) endParagraph()
  // A table left open by a damaged file still gives up its rows.
  while (tables.length) lines.push(...tables.shift()!.rows)

  return lines
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body] ?? whole
  })
}
