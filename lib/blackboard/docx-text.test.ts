// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DOCX_MAX_INFLATED_BYTES, DocxError, decodeEntities, docxToText, documentXmlToText, readZipEntry } from './docx-text'

const enc = new TextEncoder()

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** A minimal zip: local headers, central directory, end record. CRCs are left at 0 (not checked). */
async function makeZip(entries: { name: string; data: string; method: 0 | 8 }[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = enc.encode(entry.name)
    const raw = enc.encode(entry.data)
    const body = entry.method === 8 ? await deflateRaw(raw) : raw
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, entry.method, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const cd = new Uint8Array(46 + name.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, entry.method, true)
    cv.setUint32(20, body.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cd.set(name, 46)
    parts.push(local, body)
    central.push(cd)
    offset += local.length + body.length
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const all = [...parts, ...central, eocd]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of all) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const doc = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`

const p = (...runs: string[]) => `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>${runs.join('')}</w:p>`
const r = (inner: string) => `<w:r><w:rPr><w:b/></w:rPr>${inner}</w:r>`
const t = (text: string) => `<w:t xml:space="preserve">${text}</w:t>`
const cell = (...paragraphs: string[]) => `<w:tc><w:tcPr><w:tcW w:w="2000"/></w:tcPr>${paragraphs.join('')}</w:tc>`
const tr = (...cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`

const headerRow = tr(cell(p(r(t('Assessment')))), cell(p(r(t('Due')))))
const essayRow = tr(cell(p(r(t('Summative essay')))), cell(p(r(t('16 February 2027'))), p(r(t('by 2pm')))))
const handbook = doc(
  p(r(t('Module Handbook')), r(t(' GEOG1081'))) +
    p(r(t('Lecturer:')), r('<w:tab/>'), r(t('Dr Smith'))) +
    p(r(t('Line one')), r('<w:br/>'), r(t('line two'))) +
    `<w:tbl><w:tblPr/>${headerRow}${essayRow}</w:tbl>` +
    p(r(t('Fish &amp; chips &lt;3 &#8211; &#x2019;s &quot;ok&quot;'))) +
    p(r('<w:instrText> PAGE </w:instrText>'), r(t('Kept'))) +
    p(r(`<w:delText>deleted</w:delText>`)) +
    p(),
)

describe('docxToText', () => {
  it('reads a deflated document.xml: paragraphs, tabs, breaks, tables, entities', async () => {
    const zip = await makeZip([
      { name: '[Content_Types].xml', data: '<Types/>', method: 8 },
      { name: 'word/document.xml', data: handbook, method: 8 },
    ])
    expect(await docxToText(zip)).toBe(
      [
        'Module Handbook GEOG1081',
        'Lecturer:\tDr Smith',
        'Line one',
        'line two',
        'Assessment | Due',
        'Summative essay | 16 February 2027 by 2pm',
        'Fish & chips <3 – ’s "ok"',
        'Kept',
      ].join('\n'),
    )
  })

  it('reads a stored (uncompressed) entry', async () => {
    const zip = await makeZip([{ name: 'word/document.xml', data: doc(p(r(t('Stored text')))), method: 0 }])
    expect(await docxToText(zip)).toBe('Stored text')
  })

  it('throws a clear error when word/document.xml is missing', async () => {
    const zip = await makeZip([{ name: 'ppt/presentation.xml', data: '<p/>', method: 0 }])
    await expect(docxToText(zip)).rejects.toThrow(/word\/document\.xml is missing/)
    await expect(docxToText(zip)).rejects.toBeInstanceOf(DocxError)
  })

  it('rejects a truncated zip', async () => {
    const zip = await makeZip([{ name: 'word/document.xml', data: handbook, method: 8 }])
    await expect(docxToText(zip.subarray(0, Math.floor(zip.length / 2)))).rejects.toBeInstanceOf(DocxError)
    // Cut inside the file data but with the directory intact: the data overruns.
    const lying = zip.slice()
    new DataView(lying.buffer).setUint32(lying.length - 22 + 16, 2, true)
    await expect(docxToText(lying)).rejects.toBeInstanceOf(DocxError)
    await expect(docxToText(new Uint8Array(10))).rejects.toThrow(/Not a zip file/)
  })
})

describe('inflate cap', () => {
  it('exports a 50 MB limit', () => {
    expect(DOCX_MAX_INFLATED_BYTES).toBe(50 * 1024 * 1024)
  })
  it('throws once the inflated size passes the limit, even if the directory lies', async () => {
    const zip = await makeZip([{ name: 'word/document.xml', data: 'a'.repeat(256 * 1024), method: 8 }])
    // Make the central directory claim a tiny size so only the streaming check can catch it.
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    for (let i = 0; i < zip.length - 4; i++) {
      if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 10, true)
    }
    await expect(readZipEntry(zip, 'word/document.xml', 64 * 1024)).rejects.toThrow(DocxError)
    await expect(readZipEntry(zip, 'word/document.xml', 64 * 1024)).rejects.toThrow(/larger than/)
  })
  it('rejects a central-directory size over the limit before inflating', async () => {
    const zip = await makeZip([{ name: 'word/document.xml', data: 'a'.repeat(256 * 1024), method: 8 }])
    await expect(readZipEntry(zip, 'word/document.xml', 64 * 1024)).rejects.toThrow(/larger than/)
  })
  it('still reads a normal document under the default limit', async () => {
    const zip = await makeZip([{ name: 'word/document.xml', data: doc(p(r(t('Hello')))), method: 8 }])
    expect(await docxToText(zip)).toBe('Hello')
  })
})

describe('documentXmlToText', () => {
  it('flattens a table nested in a cell into that cell', () => {
    const inner = `<w:tbl>${tr(cell(p(r(t('a')))), cell(p(r(t('b')))))}</w:tbl>`
    const xml = doc(`<w:tbl>${tr(cell(p(r(t('Week 12')))), cell(inner))}</w:tbl>`)
    expect(documentXmlToText(xml)).toBe('Week 12 | a | b')
  })

  it('skips text-box fallbacks that repeat the choice', () => {
    const xml = doc(
      p(r(`<mc:AlternateContent><mc:Choice><w:txbxContent>${p(r(t('Box')))}</w:txbxContent></mc:Choice><mc:Fallback><w:txbxContent>${p(r(t('Box')))}</w:txbxContent></mc:Fallback></mc:AlternateContent>`)),
    )
    expect(documentXmlToText(xml)).toBe('Box')
  })
})

describe('decodeEntities', () => {
  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&nbsp; &amp;amp;')).toBe('&nbsp; &amp;')
  })
})
