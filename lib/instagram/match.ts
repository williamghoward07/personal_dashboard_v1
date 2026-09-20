import type { InstagramFollow, Person } from '@/lib/types'

// Local (non-AI) heuristic for suggesting which Person an imported Instagram
// follow probably is. Instagram's export never gives us a display name (see
// follows.ts — upsertFollows only ever sets handle/followed_at on insert),
// so this mostly compares a handle like "jess_dudley_" against a person's
// full name. Dots/underscores/digits already fall out as token separators
// via normalizeForMatch, so "jess_dudley_" tokenizes to ["jess","dudley"].

export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(s: string): string[] {
  const normalized = normalizeForMatch(s)
  return normalized ? normalized.split(' ') : []
}

function diceCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let overlap = 0
  for (const token of setA) if (setB.has(token)) overlap++
  return (2 * overlap) / (setA.size + setB.size)
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

/**
 * 0..1 similarity blending token overlap (handles "jess_dudley_" vs
 * "Jess Dudley") with a Levenshtein ratio over the concatenated,
 * separator-free forms (handles "durhamcollegerunning" vs "Durham College
 * Running", where there's no separator to tokenize on).
 */
export function similarityScore(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  const tokenScore = diceCoefficient(tokensA, tokensB)
  const ratioScore = levenshteinRatio(tokensA.join(''), tokensB.join(''))
  return Math.max(tokenScore, ratioScore)
}

export interface MatchSuggestion {
  person: Person
  score: number
}

const DEFAULT_THRESHOLD = 0.72

export function suggestMatch(
  follow: Pick<InstagramFollow, 'handle' | 'display_name'>,
  people: Person[],
  opts?: { threshold?: number }
): MatchSuggestion | null {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD
  let best: MatchSuggestion | null = null
  for (const person of people) {
    if (person.archived) continue
    const handleScore = similarityScore(follow.handle, person.full_name)
    const nameScore = follow.display_name ? similarityScore(follow.display_name, person.full_name) : 0
    const score = Math.max(handleScore, nameScore)
    if (score >= threshold && (!best || score > best.score)) best = { person, score }
  }
  return best
}

/** Capped, readable summary of a batch of proposed links, for a confirm dialog. */
export function describeMatchBatch(
  matches: { follow: InstagramFollow; person: Person; score: number }[],
  maxLines = 15
): string {
  const lines = matches
    .slice(0, maxLines)
    .map((m) => `@${m.follow.handle} → ${m.person.full_name} (${Math.round(m.score * 100)}% match)`)
  const remaining = matches.length - maxLines
  if (remaining > 0) lines.push(`…and ${remaining} more`)
  return lines.join('\n')
}
