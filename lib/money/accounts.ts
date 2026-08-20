import type { Account, Transaction } from '@/lib/types'
import { minorUnitsOf, netChangeMinorUnits, type ChangePeriod } from '@/lib/money'
import type { StarlingSpaceBalance } from './use-starling-balances'

export interface AccountBalance {
  account: Account
  minorUnits: number
  currency: string
}

// A resolved balance ready to render: still loading, unavailable (fetch
// failed / Starling not connected), or a concrete figure. Manual accounts
// only ever produce the concrete case (computed, not fetched); Starling
// accounts can be any of the three depending on the live balance call.
export type AccountBalanceState = 'loading' | 'unavailable' | { minorUnits: number; currency: string }

// One place both the main Money page and an account's detail page
// resolve "what does this account's balance card show right now" —
// manual accounts compute it locally; Starling accounts look themselves
// up (by external_id) in whatever /api/starling/balance last returned.
export function resolveAccountBalance(
  account: Account,
  transactions: Transaction[],
  starlingBalances: 'loading' | 'unavailable' | { externalId: string; minorUnits: number; currency: string }[]
): AccountBalanceState {
  if (account.source === 'manual') {
    const { minorUnits, currency } = computeAccountBalance(account, transactions)
    return { minorUnits, currency }
  }

  if (starlingBalances === 'loading') return 'loading'
  if (starlingBalances === 'unavailable') return 'unavailable'

  const match = starlingBalances.find((b) => b.externalId === account.external_id)
  return match ? { minorUnits: match.minorUnits, currency: match.currency } : 'unavailable'
}

// Companion to resolveAccountBalance — the Spaces nested inside this
// account, purely for display as a breakdown of the balance above (never
// summed again elsewhere, since that balance already includes them).
// Manual accounts never have Spaces.
export function resolveAccountSpaces(
  account: Account,
  starlingBalances: 'loading' | 'unavailable' | { externalId: string; spaces: StarlingSpaceBalance[] }[]
): 'loading' | 'unavailable' | StarlingSpaceBalance[] {
  if (account.source === 'manual') return []
  if (starlingBalances === 'loading') return 'loading'
  if (starlingBalances === 'unavailable') return 'unavailable'

  const match = starlingBalances.find((b) => b.externalId === account.external_id)
  return match ? match.spaces : 'unavailable'
}

// Manual accounts only — opening balance + the signed sum of that
// account's own transactions (income positive, outgoing negative), never
// a parsed "closing balance" off a statement page. Starling accounts'
// balance is always fetched live from /api/starling/balance and should
// never be computed here — callers resolve those separately and only call
// this for source === 'manual' accounts.
export function computeAccountBalance(account: Account, transactions: Transaction[]): AccountBalance {
  const netMinorUnits = transactions
    .filter((t) => t.account_id === account.id)
    .reduce((sum, t) => sum + (t.type === 'income' ? minorUnitsOf(t) : -minorUnitsOf(t)), 0)

  return {
    account,
    minorUnits: account.opening_balance_minor_units + netMinorUnits,
    currency: account.currency,
  }
}

// Rolling net change for one account's own transactions — same period
// semantics as lib/money.ts's netChangeMinorUnits, just pre-scoped to a
// single account instead of a source.
export function accountNetChangeMinorUnits(
  account: Account,
  transactions: Transaction[],
  period: ChangePeriod
): number {
  return netChangeMinorUnits(
    transactions.filter((t) => t.account_id === account.id),
    period
  )
}

// Pinned accounts float to the top; creation order within each group
// (oldest first, matching how every list/board elsewhere in this app
// orders un-prioritized items).
export function sortAccounts(accounts: Account[]): Account[] {
  return accounts.slice().sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return a.created_at.localeCompare(b.created_at)
  })
}

export interface MinorUnitsAndCurrency {
  minorUnits: number
  currency: string
}

// Sums every account's balance into one figure. Assumes a single currency
// across all accounts — the same simplification the app already made
// before this phase (Starling's own balance endpoint just picks one
// currency label rather than converting). Not solved here, just not
// silently mislabeled — see hasMixedCurrencies for callers that want to
// flag it. Takes just {minorUnits, currency} rather than a full
// AccountBalance, since the account itself is irrelevant to a sum.
export function computeOverallBalance(balances: MinorUnitsAndCurrency[]): MinorUnitsAndCurrency {
  const minorUnits = balances.reduce((sum, b) => sum + b.minorUnits, 0)
  const currency = balances[0]?.currency ?? 'GBP'
  return { minorUnits, currency }
}

export function hasMixedCurrencies(balances: MinorUnitsAndCurrency[]): boolean {
  return new Set(balances.map((b) => b.currency)).size > 1
}

// Rolling net change across a set of accounts combined — scoped to
// exactly those accounts' transactions (defensive against stray rows
// whose account_id doesn't resolve to any account currently in view).
export function overallNetChangeMinorUnits(
  accounts: Account[],
  transactions: Transaction[],
  period: ChangePeriod
): number {
  const accountIds = new Set(accounts.map((a) => a.id))
  return netChangeMinorUnits(
    transactions.filter((t) => t.account_id != null && accountIds.has(t.account_id)),
    period
  )
}
