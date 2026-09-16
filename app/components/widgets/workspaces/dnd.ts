// Native HTML5 DnD is used for the whole links grid (not @dnd-kit, which
// is pointer-event-based and can't receive an external browser drag
// source like a URL dragged from the address bar). See LinksGrid.tsx.

/**
 * Pulls a URL out of a native drop event's DataTransfer, whether it came
 * from a browser address bar (text/uri-list, possibly followed by a
 * `#title` comment line) or a plain text drag (text/plain). Returns null
 * if nothing URL-shaped was dropped.
 */
export function extractDroppedUrl(dataTransfer: DataTransfer): string | null {
  const raw = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain')
  if (!raw) return null

  const line = raw.split(/\r\n|\r|\n/).find((l) => l && !l.startsWith('#')) ?? raw
  try {
    return new URL(line).toString()
  } catch {
    // fall through
  }
  try {
    return new URL(`https://${line}`).toString()
  } catch {
    return null
  }
}
