// Pure ranking for Find. The route fetches a wide candidate pool per table
// and this decides which few are shown, so a row matching every keyword
// beats one matching a single keyword. No AI here.
import type { SearchResultItem } from './types'

export interface RankCandidate {
  item: SearchResultItem
  /** Text of the main field (title/name). */
  primary: string
  /** Text of the other searched fields (notes, description, company …). */
  secondary: string[]
  /** ISO date/time used for recency (created_at, date, due_date …); null if none. */
  date: string | null
  /** Completed / archived / done — ranked below live items. */
  inactive?: boolean
}

export interface RankedItem {
  item: SearchResultItem
  score: number
}

// Weights (case-insensitive substring matching), per keyword:
//   matched in primary           +3   (+1 more if at a word boundary)
//   matched only in secondary    +1
// plus:
//   every keyword matched somewhere   +2
//   recency                           0..1 — 1 for today or up to 30 days
//                                     ahead, falling linearly to 0 at 90
//                                     days ago (future beyond 30 days = 0)
//   inactive                          -2
const PRIMARY = 3
const BOUNDARY = 1
const SECONDARY = 1
const ALL_MATCHED = 2
const INACTIVE = -2
const RECENT_DAYS = 90
const AHEAD_DAYS = 30
const DAY_MS = 86_400_000

function recency(date: string | null, now: Date): number {
  if (!date) return 0
  const t = Date.parse(date)
  if (Number.isNaN(t)) return 0
  const ageDays = (now.getTime() - t) / DAY_MS
  if (ageDays < -AHEAD_DAYS) return 0
  if (ageDays <= 0) return 1
  return Math.max(0, 1 - ageDays / RECENT_DAYS)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function scoreCandidate(c: RankCandidate, keywords: string[], now: Date): number {
  let score = 0
  const primary = c.primary.toLowerCase()
  const secondary = c.secondary.map((s) => s.toLowerCase())
  let matched = 0

  for (const raw of keywords) {
    const kw = raw.toLowerCase().trim()
    if (!kw) continue
    if (primary.includes(kw)) {
      score += PRIMARY
      if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(kw)}`, 'u').test(primary)) score += BOUNDARY
      matched++
    } else if (secondary.some((s) => s.includes(kw))) {
      score += SECONDARY
      matched++
    }
  }

  const live = keywords.filter((k) => k.trim())
  if (live.length > 0 && matched === live.length) score += ALL_MATCHED
  score += recency(c.date, now)
  if (c.inactive) score += INACTIVE
  return score
}

function dateMs(date: string | null): number {
  const t = date ? Date.parse(date) : NaN
  return Number.isNaN(t) ? -Infinity : t
}

/** Top `limit` candidates with their scores, best first. */
export function rankCandidatesScored(cands: RankCandidate[], keywords: string[], now: Date, limit: number): RankedItem[] {
  const hasKeywords = keywords.some((k) => k.trim())
  return cands
    .map((c) => ({
      c,
      // Browse-all: recency only, inactive last.
      score: hasKeywords ? scoreCandidate(c, keywords, now) : recency(c.date, now) + (c.inactive ? INACTIVE : 0),
    }))
    .sort((a, b) => b.score - a.score || dateMs(b.c.date) - dateMs(a.c.date))
    .slice(0, limit)
    .map(({ c, score }) => ({ item: c.item, score }))
}

export function rankCandidates(cands: RankCandidate[], keywords: string[], now: Date, limit: number): SearchResultItem[] {
  return rankCandidatesScored(cands, keywords, now, limit).map((r) => r.item)
}
