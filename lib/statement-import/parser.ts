// Generic (not per-bank) heuristic line parser for bank statement text
// extracted from a PDF. A line is transaction-shaped if it has both a
// date-like token and an amount-like token; when a line has more than one
// amount (a common layout: transaction amount + running balance), the
// first one — reading left to right — is taken as the amount, matching
// how most statement exports order those two columns.
//
// Direction (income vs outgoing) is a best-effort guess, not a claim:
// an explicit sign or parenthesised negative is trusted, but an unsigned
// amount defaults to "outgoing" (statistically the more common line on a
// personal current account) rather than "income". Getting this wrong for
// some rows is expected — the review step this feeds is the real
// correctness guarantee, not this heuristic.

export interface StatementLineCandidate {
  raw: string
  date: string
  amount: number
  type: 'income' | 'outgoing'
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

function toIsoDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const fullYear = year < 100 ? 2000 + year : year
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function matchDate(line: string, statementYear: number): { date: string; matchText: string } | null {
  const numeric = NUMERIC_DATE_RE.exec(line)
  if (numeric) {
    const [matchText, day, month, year] = numeric
    const iso = toIsoDate(Number(day), Number(month), Number(year))
    if (iso) return { date: iso, matchText }
  }

  const named = MONTH_NAME_DATE_RE.exec(line)
  if (named) {
    const [matchText, day, monthName, year] = named
    const month = MONTHS[monthName.slice(0, 3).toLowerCase()]
    if (month) {
      const iso = toIsoDate(Number(day), month, year ? Number(year) : statementYear)
      if (iso) return { date: iso, matchText }
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
  const isExplicitlyPositive = trimmed.startsWith('+')

  const amount = Number(trimmed.replace(/[^\d.]/g, ''))
  if (Number.isNaN(amount) || amount === 0) return null

  return {
    amount,
    type: isNegative ? 'outgoing' : isExplicitlyPositive ? 'income' : 'outgoing',
    matchText,
  }
}

// statementYear resolves a bare "05 Aug" line with no year of its own —
// the caller (the parse API route) decides that, typically from the
// statement's own period/upload date, so this stays a pure function of
// its inputs rather than reading the wall clock itself.
export function parseStatementText(text: string, statementYear: number): StatementLineCandidate[] {
  const candidates: StatementLineCandidate[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const dateMatch = matchDate(line, statementYear)
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
      description: description || 'Statement transaction',
    })
  }

  return candidates
}
