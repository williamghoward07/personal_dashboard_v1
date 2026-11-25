// Links embedded in Blackboard item HTML (bodies, descriptions) → the
// `bb_content.links` entries. Pure and DOM-free (it runs on the server and
// in the extension's service worker): a small, tolerant regex parser.
//
// htmlToText lives here too (normalise.ts re-exports it) so the two modules
// don't import each other at runtime.
//
// Blackboard's embedded-file URLs (`resourceUrl`, `viewerUrl`, anything under
// `/sessions/`) are session-scoped and expire, so they are never stored: a
// file is stored as a link to the content item that holds it.

import { BB_ORIGIN, absoluteUrl } from './client'
import { cleanText } from './text'
import type { BbContentLink, BbContentLinkKind } from './types'

export type { BbContentLink, BbContentLinkKind }

/** Most links kept per content item. */
export const MAX_LINKS_PER_ITEM = 100
const MAX_LABEL = 300
const MAX_HTML = 200_000

// Postgres-safe text lives in ./text (shared, pure); re-exported for existing importers.
export { cleanText }

// ------------------------------------------------------------- html text --

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Decode HTML character references (`&amp;`, `&#39;`, `&#x263A;`). Unknown names are kept as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Blackboard HTML (announcement bodies, feedback, item bodies) → plain text with paragraph breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|ul|ol)\s*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// -------------------------------------------------------------- classify --

const SLIDE_MIME = /powerpoint|presentationml/i
const SLIDE_EXT = /\.(pptx?|ppsx?|key|odp)$/i
const FILE_EXT = /\.(pdf|docx?|xlsx?|csv|txt|rtf|odt|ods|zip|mp4|mp3|m4a|mov|wav|png|jpe?g|gif)$/i

/** Lowercase, without the one trailing dot DNS allows (`blackboard.durham.ac.uk.`). */
export function normaliseHost(host: string): string {
  const lower = host.toLowerCase()
  return lower.endsWith('.') ? lower.slice(0, -1) : lower
}

/** Hosts Blackboard owns: Durham's Ultra, `*.blackboard.com` (alt-*, *.files) and `*.blackboardcdn.com`. */
export function isBlackboardHost(host: string): boolean {
  const h = normaliseHost(host)
  return (
    h === new URL(BB_ORIGIN).hostname ||
    h === 'blackboard.com' ||
    h.endsWith('.blackboard.com') ||
    h === 'blackboardcdn.com' ||
    h.endsWith('.blackboardcdn.com')
  )
}

function hostOf(href: string): string | null {
  try {
    return normaliseHost(new URL(href).hostname) || null
  } catch {
    return null
  }
}

function pathOf(href: string): string {
  try {
    return decodeURIComponent(new URL(href).pathname)
  } catch {
    return ''
  }
}

/** Talis (reading lists), Panopto (recordings), slides, other files, else `other`. */
export function classifyLink(href: string, label: string, mime?: string): BbContentLinkKind {
  const host = hostOf(href)
  if (host && (host === 'talis.com' || host.endsWith('.talis.com'))) return 'talis'
  if (host && host.split('.').includes('panopto')) return 'panopto'
  const name = label.trim()
  const path = pathOf(href)
  if ((mime && SLIDE_MIME.test(mime)) || SLIDE_EXT.test(name) || SLIDE_EXT.test(path)) return 'slides'
  if ((mime && !/^text\/html\b/i.test(mime)) || FILE_EXT.test(name) || FILE_EXT.test(path)) return 'file'
  return 'other'
}

// ------------------------------------------------------------------ hrefs --

/**
 * A raw href → an absolute http(s) URL that is safe to store, else null.
 * Drops `javascript:`, `mailto:`, `data:` and in-page `#` links. On any
 * Blackboard host the query and hash are dropped (signatures, session ids),
 * and session-scoped URLs (`/sessions/…`, `*.files.blackboard.com`,
 * `alt-*.blackboard.com`) become the item's own URL.
 */
export function safeHref(raw: string, itemUrl: string): string | null {
  const href = decodeEntities(raw).trim()
  if (!href || href.startsWith('#') || /^(javascript|mailto|data|tel):/i.test(href)) return null
  let url: URL
  try {
    url = new URL(absoluteUrl(href))
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (isBlackboardHost(url.hostname)) {
    const host = normaliseHost(url.hostname)
    let path: string
    try {
      path = decodeURIComponent(url.pathname)
    } catch {
      return itemUrl // malformed escapes: can't tell what it is, so don't keep it
    }
    if (/\/sessions\//i.test(path) || host.endsWith('.files.blackboard.com') || /^alt-[^.]*\.blackboard\.com$/.test(host)) return itemUrl
    url.hostname = host
    url.search = ''
    url.hash = ''
  }
  return cleanText(url.toString())
}

// ----------------------------------------------------------------- parse --

/** Opening tags; quoted attribute values may contain `>`. */
const OPEN_TAG = /<([a-z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

function parseAttrs(source: string): Map<string, string> {
  const attrs = new Map<string, string>()
  for (const m of source.matchAll(ATTR)) {
    const name = m[1].toLowerCase()
    if (!attrs.has(name)) attrs.set(name, m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** `data-bbfile` is JSON, HTML-entity-escaped (sometimes twice). */
function parseBbFile(raw: string): Record<string, unknown> | null {
  let text = raw
  for (let i = 0; i < 3; i++) {
    text = decodeEntities(text)
    try {
      return asObject(JSON.parse(text))
    } catch {
      // try one more level of unescaping
    }
  }
  return null
}

function s(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function label(text: string): string {
  return cleanText(text.replace(/\s+/g, ' ').trim(), MAX_LABEL)
}

function fromBbFile(data: Record<string, unknown>, itemUrl: string): BbContentLink | null {
  const mime = s(data.mimeType)
  // Embedded apps / links: { linkType, url, title, … }.
  if (!mime && !s(data.fileName) && s(data.url)) {
    const href = safeHref(s(data.url), itemUrl)
    if (!href) return null
    const name = label(htmlToText(s(data.title) || s(data.linkName) || s(data.displayName))) || hostOf(href) || href
    return { href, label: name, kind: classifyLink(href, name) }
  }
  if (data.isDecorative === true || /^image\//i.test(mime)) return null
  const fileName = s(data.fileName)
  const name = label(fileName || s(data.linkName) || s(data.displayName)) || 'File'
  // Never resourceUrl / viewerUrl: they are session-signed and expire.
  const kind = classifyLink(itemUrl, fileName || name, mime || undefined)
  const link: BbContentLink = { href: itemUrl, label: name, kind: kind === 'other' ? 'file' : kind }
  if (mime) link.mime = cleanText(mime, MAX_LABEL)
  return link
}

function fromAnchor(attrs: Map<string, string>, inner: string, itemUrl: string): BbContentLink | null {
  const raw = attrs.get('href')
  if (raw === undefined) return null
  const href = safeHref(raw, itemUrl)
  if (!href) return null
  const name = label(htmlToText(inner)) || label(decodeEntities(attrs.get('title') ?? '')) || hostOf(href) || href
  return { href, label: name, kind: classifyLink(href, name) }
}

/**
 * Links in an item's HTML: plain `<a href>` anchors and `data-bbfile`
 * embedded files. Files point at `itemUrl`; decorative images are skipped.
 * Deduped by href + label, at most MAX_LINKS_PER_ITEM.
 */
export function extractLinks(html: string, itemUrl: string): BbContentLink[] {
  if (typeof html !== 'string' || html === '') return []
  // Real bodies are 2–9 KB; the cap bounds the regex work on junk input.
  const source = html.slice(0, MAX_HTML)
  const found: BbContentLink[] = []
  for (const m of source.matchAll(OPEN_TAG)) {
    const tag = m[1].toLowerCase()
    const attrs = parseAttrs(m[2])
    const bbFile = attrs.get('data-bbfile')
    if (bbFile !== undefined) {
      const data = parseBbFile(bbFile)
      const link = data ? fromBbFile(data, itemUrl) : null
      if (link) found.push(link)
      continue
    }
    if (tag !== 'a') continue
    const start = (m.index ?? 0) + m[0].length
    const close = /<\/a\s*>/i.exec(source.slice(start))
    const inner = close ? source.slice(start, start + close.index) : ''
    const link = fromAnchor(attrs, inner, itemUrl)
    if (link) found.push(link)
  }
  return dedupeLinks(found)
}

/** One entry per href + label (first wins), capped at MAX_LINKS_PER_ITEM. */
export function dedupeLinks(links: BbContentLink[]): BbContentLink[] {
  const seen = new Set<string>()
  const out: BbContentLink[] = []
  for (const link of links) {
    const key = `${link.href}\u0000${link.label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
    if (out.length >= MAX_LINKS_PER_ITEM) break
  }
  return out
}
