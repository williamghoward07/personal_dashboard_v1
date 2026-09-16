// Custom #tags for the Thinking Log. Stored lowercase without the '#'.

const MAX_TAG_LENGTH = 40

// '#' only counts at the start of the text or after whitespace, so a URL
// fragment like example.com/page#section isn't read as a tag.
const HASHTAG_PATTERN = /(^|\s)#([\p{L}\p{N}_-]+)/gu

/** Cleans user input into a stored tag, or null if nothing usable is left. */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG_LENGTH)
  if (!tag) return null
  // "#1" / "#2024" read as numbering, not tags.
  if (/^\p{N}+$/u.test(tag)) return null
  return tag
}

/** Unique tags written inline as #hashtags, in first-seen order. */
export function extractHashtags(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const tag = normalizeTag(match[2])
    if (tag) found.push(tag)
  }
  return mergeTags(found)
}

/** Concatenates tag lists, de-duplicated, first occurrence wins. */
export function mergeTags(...lists: string[][]): string[] {
  return [...new Set(lists.flat())]
}

/** Every distinct tag across notes, most-used first (ties alphabetical). */
export function tagSuggestions(notes: { tags: string[] }[]): string[] {
  const counts = new Map<string, number>()
  for (const note of notes) for (const tag of note.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag)
}
