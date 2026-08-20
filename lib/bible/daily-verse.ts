// Pure — no Supabase import, deliberately, so this stays unit-testable
// without env vars (see daily-verse-repo.ts for the data-access half of
// this module, matching the pure/impure split used throughout the
// codebase, e.g. lib/money/accounts.ts vs lib/money/use-accounts.ts).

// Day-of-year for a 'YYYY-MM-DD' key, 1-indexed. Timezone-free by
// construction — once you have a calendar date, its day-of-year doesn't
// depend on timezone anymore, only on the date itself, matching the same
// principle lib/habits/schedule.ts's isoWeekday relies on.
function dayOfYear(dateKeyValue: string): number {
  const [year, month, day] = dateKeyValue.split('-').map(Number)
  const startOfYearUTC = Date.UTC(year, 0, 1)
  const thisDayUTC = Date.UTC(year, month - 1, day)
  return Math.floor((thisDayUTC - startOfYearUTC) / 86_400_000) + 1
}

// Which position in the curated bible_daily_verses list today's verse is.
// Deterministic (same date always gives the same index) and date-stable,
// per the Daily Verse widget's spec — the list is expected to be shorter
// than a year, so this cycles rather than needing 365/366 individually
// curated rows (see the plan's Decision 4).
export function getDailyVerseIndex(dateKeyValue: string, listLength: number): number {
  if (listLength <= 0) return 0
  return (dayOfYear(dateKeyValue) - 1) % listLength
}
