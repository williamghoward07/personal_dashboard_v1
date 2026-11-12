import { describe, expect, it } from 'vitest'
import { BB_ORIGIN } from './client'
import { MAX_LINKS_PER_ITEM, classifyLink, cleanText, extractLinks, safeHref } from './links'

const ITEM = `${BB_ORIGIN}/ultra/courses/_100_1/outline/edit/document/_5_1`
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** The way Ultra writes data-bbfile: JSON with every quote entity-escaped. */
function bbFile(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

describe('cleanText', () => {
  it('drops NUL, replaces lone surrogates, and never cuts a pair in half', () => {
    expect(cleanText('a\u0000b')).toBe('ab')
    expect(cleanText('x\ud800y\udc00z')).toBe('x\ufffdy\ufffdz')
    expect(cleanText('ab\ud83d\ude00', 3)).toBe('ab')
    expect(cleanText('ab\ud83d\ude00', 4)).toBe('ab\ud83d\ude00')
  })
  it('keeps link labels safe', () => {
    const html = `<a href="https://example.org/">${'x'.repeat(299)}\ud83d\ude00 and \u0000 more</a>`
    const [link] = extractLinks(html, ITEM)
    expect(link.label).toBe('x'.repeat(299))
  })
})

describe('classifyLink', () => {
  it('recognises Talis, Panopto, slides and files', () => {
    expect(classifyLink('https://rl.talis.com/3/durham/lists/ABC.html', 'Reading list')).toBe('talis')
    expect(classifyLink('https://durham.talis.com/x', 'x')).toBe('talis')
    expect(classifyLink('https://durham.cloud.panopto.eu/Panopto/Pages/Viewer.aspx?id=1', 'Recording')).toBe('panopto')
    expect(classifyLink(ITEM, 'Lecture 3.pptx')).toBe('slides')
    expect(classifyLink(ITEM, 'Lecture 3', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('slides')
    expect(classifyLink(ITEM, 'Handbook', 'application/pdf')).toBe('file')
    expect(classifyLink('https://www.dur.ac.uk/x/guide.PDF', 'Guide')).toBe('file')
    expect(classifyLink('https://www.sciencedirect.com/science/article/pii/S1', 'Paper')).toBe('other')
  })
  it('does not treat lookalike hosts as Talis', () => {
    expect(classifyLink('https://nottalis.com/x', 'x')).toBe('other')
  })
})

describe('safeHref', () => {
  it('makes relative links absolute and drops non-web schemes and anchors', () => {
    expect(safeHref('/ultra/courses/_1_1/outline', ITEM)).toBe(`${BB_ORIGIN}/ultra/courses/_1_1/outline`)
    expect(safeHref('javascript:alert(1)', ITEM)).toBeNull()
    expect(safeHref('MAILTO:x@durham.ac.uk', ITEM)).toBeNull()
    expect(safeHref('#top', ITEM)).toBeNull()
    expect(safeHref('', ITEM)).toBeNull()
  })
  it('never stores session-scoped or signed Blackboard URLs', () => {
    expect(safeHref(`${BB_ORIGIN}/sessions/abc/def/file.docx?sig=1`, ITEM)).toBe(ITEM)
    expect(safeHref('/bbcswebdav/pid-1-dt-content-rid-2_1/xid-2_1?X-Blackboard-Signature=zz', ITEM)).toBe(
      `${BB_ORIGIN}/bbcswebdav/pid-1-dt-content-rid-2_1/xid-2_1`,
    )
    // Query strings off Blackboard are kept as written.
    expect(safeHref('https://www.dur.ac.uk/search?q=rivers&amp;page=2', ITEM)).toBe('https://www.dur.ac.uk/search?q=rivers&page=2')
  })
})

describe('safeHref leaks', () => {
  it('maps signed file-store and alt-host URLs to the item', () => {
    expect(safeHref('https://prod01-eu-central-1.xythos.prod.files.blackboard.com/abc/1?X-Blob-Signature=SIG', ITEM)).toBe(ITEM)
    expect(safeHref('https://alt-5f1a.blackboard.com/bbcswebdav/x?sig=1', ITEM)).toBe(ITEM)
  })
  it('strips the query and hash on every Blackboard host', () => {
    expect(safeHref(`${BB_ORIGIN}/webapps/blackboard/execute/x?session_id=SECRET#frag`, ITEM)).toBe(`${BB_ORIGIN}/webapps/blackboard/execute/x`)
    expect(safeHref('https://eu-lti.bbcollab.blackboardcdn.com/x?token=T', ITEM)).toBe('https://eu-lti.bbcollab.blackboardcdn.com/x')
    expect(safeHref('https://help.blackboard.com/Learn?sid=1', ITEM)).toBe('https://help.blackboard.com/Learn')
  })
  it('recognises encoded /sessions/ paths and trailing-dot hosts', () => {
    expect(safeHref(`${BB_ORIGIN}/%73essions/a/b/f.pdf?sig=1`, ITEM)).toBe(ITEM)
    expect(safeHref('https://blackboard.durham.ac.uk./sessions/a/b/f.pdf?sig=1', ITEM)).toBe(ITEM)
    expect(safeHref('https://BLACKBOARD.durham.ac.uk./ultra/stream?x=1', ITEM)).toBe(`${BB_ORIGIN}/ultra/stream`)
    // Malformed escapes on a Blackboard host are not kept.
    expect(safeHref(`${BB_ORIGIN}/%E0%A4%A/x?sig=1`, ITEM)).toBe(ITEM)
  })
  it('still drops scripts and data, however they are written', () => {
    expect(safeHref('data:text/html,<b>x</b>', ITEM)).toBeNull()
    expect(safeHref('&#106;avascript:alert(1)', ITEM)).toBeNull()
    expect(safeHref('java&#x09;script:alert(1)', ITEM)).toBeNull()
    expect(safeHref('java\tscript:alert(1)', ITEM)).toBeNull()
    expect(safeHref('  JaVaScRiPt:alert(1)', ITEM)).toBeNull()
  })
  it('resolves protocol-relative links, still sanitising Blackboard ones', () => {
    expect(safeHref('//example.org/x?q=1', ITEM)).toBe('https://example.org/x?q=1')
    expect(safeHref('//blackboard.durham.ac.uk/sessions/1/2/f.pdf', ITEM)).toBe(ITEM)
  })
  it('never lets a signature through extractLinks', () => {
    const html =
      '<a href="https://prod01-x.xythos.prod.files.blackboard.com/abc/1?X-Blob-Signature=SIG">Brief</a>' +
      `<a href="${BB_ORIGIN}/webapps/x?session_id=SECRET">Old page</a>` +
      `<a href="${BB_ORIGIN}/%73essions/1/2/f.pdf?sig=1">File</a>`
    const out = JSON.stringify(extractLinks(html, ITEM))
    expect(out).not.toMatch(/SIG|SECRET|sig=|essions/)
  })
})

describe('extractLinks', () => {
  it('finds a Talis reading list in a document body', () => {
    const html =
      '<p>Before the lecture, read chapter 2 from the <a href="https://rl.talis.com/3/durham/lists/1A2B.html" target="_blank">Talis Aspire reading list</a>.</p>'
    expect(extractLinks(html, ITEM)).toEqual([
      { href: 'https://rl.talis.com/3/durham/lists/1A2B.html', label: 'Talis Aspire reading list', kind: 'talis' },
    ])
  })

  it('stores an entity-escaped data-bbfile docx as the item link, never its resourceUrl', () => {
    const data = {
      alternativeText: 'Essay brief',
      displayName: 'Essay brief',
      fileName: 'GEOG1241 Essay Brief.docx',
      fileSize: 23456,
      mimeType: DOCX,
      render: 'inline',
      resourceUrl: `${BB_ORIGIN}/sessions/7/8/GEOG1241%20Essay%20Brief.docx?X-Blackboard-Expiration=1&X-Blackboard-Signature=abc`,
      linkName: 'Essay brief (docx)',
      viewerUrl: `${BB_ORIGIN}/viewer?x=1`,
    }
    const html = `<p><a href="${data.resourceUrl}" data-bbtype="attachment" data-bbfile="${bbFile(data)}">Essay brief (docx)</a></p>`
    const links = extractLinks(html, ITEM)
    expect(links).toEqual([{ href: ITEM, label: 'GEOG1241 Essay Brief.docx', kind: 'file', mime: DOCX }])
    expect(JSON.stringify(links)).not.toContain('sessions')
    expect(JSON.stringify(links)).not.toContain('Signature')
  })

  it('skips decorative and other images', () => {
    const decorative = bbFile({ fileName: 'banner.jpg', mimeType: 'image/jpeg', isDecorative: true, resourceUrl: '/sessions/1/2/banner.jpg' })
    const photo = bbFile({ fileName: 'map.png', mimeType: 'image/png', resourceUrl: '/sessions/1/2/map.png' })
    expect(extractLinks(`<img data-bbfile="${decorative}"><a href="#" data-bbfile="${photo}">map</a>`, ITEM)).toEqual([])
  })

  it('reads single-quoted attributes with raw JSON, and embedded links', () => {
    const html =
      `<a href='https://www.dur.ac.uk/geography/'>Department</a>` +
      `<a data-bbfile='{"linkType":"external","url":"https://durham.cloud.panopto.eu/Panopto/Pages/Viewer.aspx?id=9","title":"Week 12 recording"}'>x</a>`
    expect(extractLinks(html, ITEM)).toEqual([
      { href: 'https://www.dur.ac.uk/geography/', label: 'Department', kind: 'other' },
      { href: 'https://durham.cloud.panopto.eu/Panopto/Pages/Viewer.aspx?id=9', label: 'Week 12 recording', kind: 'panopto' },
    ])
  })

  it('uses the text of nested tags as the label, else the host', () => {
    const html =
      '<a href="https://mytimetable.durham.ac.uk/"><span><strong>My</strong> timetable</span></a>' +
      '<a href="https://durhamuniversity.sharepoint.com/sites/geog"><img src="x.png"></a>'
    expect(extractLinks(html, ITEM)).toEqual([
      { href: 'https://mytimetable.durham.ac.uk/', label: 'My timetable', kind: 'other' },
      { href: 'https://durhamuniversity.sharepoint.com/sites/geog', label: 'durhamuniversity.sharepoint.com', kind: 'other' },
    ])
  })

  it('drops javascript:, mailto: and # anchors, and dedupes by href + label', () => {
    const html =
      '<a href="javascript:void(0)">x</a><a href="mailto:a@b.c">mail</a><a href="#s1">jump</a><a name="n">no href</a>' +
      '<a href="https://www.dur.ac.uk/">Durham</a><a href="https://www.dur.ac.uk/">Durham</a><a href="https://www.dur.ac.uk/">Home</a>'
    expect(extractLinks(html, ITEM).map((l) => l.label)).toEqual(['Durham', 'Home'])
  })

  it('caps the links per item', () => {
    const html = Array.from({ length: 150 }, (_, i) => `<a href="https://example.org/${i}">L${i}</a>`).join('')
    expect(extractLinks(html, ITEM)).toHaveLength(MAX_LINKS_PER_ITEM)
  })

  it('survives garbage input', () => {
    expect(extractLinks('', ITEM)).toEqual([])
    expect(extractLinks('<a href="https://ok.example/">unclosed', ITEM)).toEqual([
      { href: 'https://ok.example/', label: 'ok.example', kind: 'other' },
    ])
    expect(extractLinks('<a href="http://[::bad">x</a><a data-bbfile="{not json">y</a><<<>>> <a href=', ITEM)).toEqual([])
    expect(extractLinks('<a href="https://x.example/" data-bbfile="&quot;just a string&quot;">x</a>', ITEM)).toEqual([])
    expect(extractLinks(undefined as unknown as string, ITEM)).toEqual([])
    expect(extractLinks('<a "'.repeat(5000), ITEM)).toEqual([])
  })
})
