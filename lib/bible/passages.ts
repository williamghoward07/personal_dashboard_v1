import type { BiblePassage } from './types'

// Pure — no Supabase import, deliberately, so this stays unit-testable
// without env vars (see passages-repo.ts for the data-access half of this
// module, matching the pure/impure split used throughout the codebase,
// e.g. lib/money/accounts.ts vs lib/money/use-accounts.ts).
//
// Formats a normalised passage row back into a human reference string, e.g.
// "Romans 8:1-17", "John 3:16", or "Psalm 23" for a whole-chapter row
// (verse_start/verse_end both null). Never used to fetch or render
// scripture text itself — this module only ever handles the reference.
export function formatReference(passage: Pick<BiblePassage, 'book' | 'chapter' | 'verse_start' | 'verse_end'>): string {
  const base = `${passage.book} ${passage.chapter}`
  if (passage.verse_start == null) return base
  if (passage.verse_end == null || passage.verse_end === passage.verse_start) {
    return `${base}:${passage.verse_start}`
  }
  return `${base}:${passage.verse_start}-${passage.verse_end}`
}
