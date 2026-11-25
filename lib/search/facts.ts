// Pure: exact figures for Ask, computed in TypeScript from every matching row
// so the model never adds anything up. The route fetches the rows.
import { isSuccessfulTransaction, minorUnitsOf, formatPounds } from '@/lib/money'
import type { Transaction } from '@/lib/types'
import type { ResolvedWindow } from './time-window'

export type FactTransaction = Pick<Transaction, 'amount' | 'amount_minor_units' | 'type' | 'date' | 'source' | 'raw'>

function matching(keywords: string[]): string {
  return keywords.length > 0 ? ` matching ${keywords.map((k) => `'${k}'`).join(' or ')}` : ''
}

function within(window: ResolvedWindow | null): string {
  return window ? ` in ${window.label}` : ''
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Spending and income totals. Mirrors the Money pages: type 'outgoing' is
 * spending, 'income' is income, and bank-synced rows that never moved money
 * (declined, reversed, upcoming) are excluded via isSuccessfulTransaction.
 * `capped` means the row query hit its limit, so the figures are lower bounds.
 */
export function transactionFacts(
  rows: FactTransaction[],
  keywords: string[],
  window: ResolvedWindow | null,
  capped = false,
): string[] {
  let spentMinor = 0
  let spentCount = 0
  let incomeMinor = 0
  let incomeCount = 0
  for (const row of rows as Transaction[]) {
    if (!isSuccessfulTransaction(row)) continue
    if (row.type === 'income') {
      incomeMinor += minorUnitsOf(row)
      incomeCount++
    } else {
      spentMinor += minorUnitsOf(row)
      spentCount++
    }
  }

  const scope = `${matching(keywords)}${within(window)}`
  const atLeast = capped ? 'at least ' : ''
  if (spentCount === 0 && incomeCount === 0) return [`No transactions found${scope}.`]

  const facts: string[] = []
  if (spentCount > 0) {
    facts.push(`Spending${scope}: ${atLeast}${formatPounds(spentMinor)} across ${atLeast}${plural(spentCount, 'transaction')}.`)
  } else {
    facts.push(`No spending found${scope}.`)
  }
  if (incomeCount > 0) {
    facts.push(`Income${scope}: ${atLeast}${formatPounds(incomeMinor)} across ${atLeast}${plural(incomeCount, 'transaction')}.`)
  }
  return facts
}

/** "3 open todos due in this week (…)." — `capped` when the pool hit its limit. */
export function dueCountFact(
  noun: 'todo' | 'task',
  openCount: number,
  keywords: string[],
  window: ResolvedWindow,
  capped = false,
): string {
  const atLeast = capped ? 'At least ' : ''
  return `${atLeast}${plural(openCount, `open ${noun}`)}${matching(keywords)} due in ${window.label}.`
}
