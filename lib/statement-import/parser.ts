// Generic (not per-bank) heuristic line parser for bank statement text
// extracted from a PDF. A line is transaction-shaped if it has both a
// date-like token and an amount-like token; when a line has more than one
// amount (a common layout: transaction amount + running balance), the
// first one — reading left to right — is taken as the amount, matching
// how most statement exports order those two columns.
//
// Direction (income vs outgoing) follows standard UK bank-statement
// convention (Monzo, Starling, etc.): outgoings are signed negative
// (leading "-" or parenthesised) and incoming amounts are left unsigned.
// So a negative/parenthesised amount is "outgoing"; anything else —
// unsigned or explicitly "+" — is "income". Getting this wrong for some
// rows is expected on statements that don't follow the convention — the
// review step this feeds is the real correctness guarantee, not this
// heuristic.

export interface StatementLineCandidate {
  raw: string
  date: string
  amount: number
  type: 'income' | 'outgoing'
  category: string
  description: string
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

// Slash/hyphen only, deliberately — a dot separator (05.08.2026) would
// collide with the amount regex's decimal point on the same digits.
const NUMERIC_DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/
const MONTH_NAME_DATE_RE = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s*(\d{4})?\b/
// \d+ (unbounded), not \d{1,3} — a 4+ digit amount with no thousands
// separator (e.g. "1500.00") needs to match as one number; capping the
// leading digit run at 3 made the regex backtrack into matching "500.00"
// out of the middle of "1500.00" instead of the whole thing.
const AMOUNT_RE = /[-+]?\(?£?\s?\d+(?:,\d{3})*\.\d{2}\)?/g

function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year
}

function toIsoDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Tracks the year across a multi-year document. Numeric dates always carry
// their own year and resync this directly; a bare month-name date ("5 Aug")
// has none, so it's resolved against `currentYear` with rollover detection
// (below) instead of a single fixed year for the whole file.
interface YearCursor {
  currentYear: number
  lastMonth: number | null
  direction: 'asc' | 'desc' | null
}

// A bare month-name line has no year of its own. Direction (ascending vs.
// descending statement order) is inferred from the first month-to-month
// change seen; once established, a jump of 6+ months against that
// direction (Dec -> Jan while ascending, Jan -> Dec while descending) is
// treated as a year rollover. Small moves — same month, or forward within
// the established direction — never trigger one, so ordinary day-level
// reordering within a month can't false-trigger it.
function resolveTrackedYear(cursor: YearCursor, month: number): number {
  if (cursor.lastMonth !== null) {
    const diff = month - cursor.lastMonth
    if (cursor.direction === null) {
      if (diff !== 0) cursor.direction = diff > 0 ? 'asc' : 'desc'
    } else if (cursor.direction === 'asc' && diff <= -6) {
      cursor.currentYear += 1
    } else if (cursor.direction === 'desc' && diff >= 6) {
      cursor.currentYear -= 1
    }
  }
  cursor.lastMonth = month
  return cursor.currentYear
}

function matchDate(line: string, cursor: YearCursor): { date: string; matchText: string } | null {
  const numeric = NUMERIC_DATE_RE.exec(line)
  if (numeric) {
    const [matchText, day, month, rawYear] = numeric
    const year = expandYear(Number(rawYear))
    const iso = toIsoDate(Number(day), Number(month), year)
    if (iso) {
      cursor.currentYear = year
      cursor.lastMonth = Number(month)
      return { date: iso, matchText }
    }
  }

  const named = MONTH_NAME_DATE_RE.exec(line)
  if (named) {
    const [matchText, day, monthName, rawYear] = named
    const month = MONTHS[monthName.slice(0, 3).toLowerCase()]
    if (month) {
      const year = rawYear ? expandYear(Number(rawYear)) : resolveTrackedYear(cursor, month)
      const iso = toIsoDate(Number(day), month, year)
      if (iso) {
        if (rawYear) {
          cursor.currentYear = year
          cursor.lastMonth = month
        }
        return { date: iso, matchText }
      }
    }
  }

  return null
}

function matchAmount(line: string): { amount: number; type: 'income' | 'outgoing'; matchText: string } | null {
  const matches = Array.from(line.matchAll(AMOUNT_RE))
  if (matches.length === 0) return null

  const matchText = matches[0][0]
  const trimmed = matchText.trim()
  const isNegative = trimmed.startsWith('-') || (trimmed.startsWith('(') && trimmed.endsWith(')'))

  const amount = Number(trimmed.replace(/[^\d.]/g, ''))
  if (Number.isNaN(amount) || amount === 0) return null

  return {
    amount,
    type: isNegative ? 'outgoing' : 'income',
    matchText,
  }
}

// statementYear seeds the year cursor for whatever comes before the first
// dated line establishes one of its own — the caller (the parse API route)
// decides that, typically from the statement's own period/upload date, so
// this stays a pure function of its inputs rather than reading the wall
// clock itself. From there, explicit-year lines resync the cursor and bare
// month-name lines are resolved against it (see YearCursor / matchDate),
// so a single multi-year document doesn't need every line to carry a year.
export function parseStatementText(text: string, statementYear: number): StatementLineCandidate[] {
  const candidates: StatementLineCandidate[] = []
  const cursor: YearCursor = { currentYear: statementYear, lastMonth: null, direction: null }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const dateMatch = matchDate(line, cursor)
    if (!dateMatch) continue

    const amountMatch = matchAmount(line)
    if (!amountMatch) continue

    // Strips every amount-shaped token, not just the one used as `amount`
    // — a trailing running-balance column is still amount-shaped and
    // would otherwise leak into the description text.
    const description = line
      .replace(dateMatch.matchText, '')
      .replace(AMOUNT_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    candidates.push({
      raw: line,
      date: dateMatch.date,
      amount: amountMatch.amount,
      type: amountMatch.type,
      // Matches the transactions.category column's own default — every
      // candidate always carries a category so review-table edits stay
      // uniform across rows (a bulk insert with some rows missing the key
      // and others not is rejected by PostgREST as inconsistent keys).
      category: 'Other',
      description: description || 'Statement transaction',
    })
  }

  return candidates
}
