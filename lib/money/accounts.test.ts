import { describe, it, expect } from 'vitest'
import type { Account, Transaction } from '@/lib/types'
import {
  computeAccountBalance,
  accountNetChangeMinorUnits,
  sortAccounts,
  computeOverallBalance,
  hasMixedCurrencies,
  overallNetChangeMinorUnits,
} from './accounts'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function makeAccount(overrides: Partial<Account> & Pick<Account, 'id'>): Account {
  return {
    name: 'Test account',
    source: 'manual',
    external_id: null,
    currency: 'GBP',
    opening_balance_minor_units: 0,
    is_pinned: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTransaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    date: daysAgo(0),
    amount: null,
    category: 'Other',
    description: null,
    type: 'outgoing',
    created_at: '2026-01-01T00:00:00.000Z',
    source: 'manual',
    external_id: null,
    account_label: null,
    merchant_name: null,
    amount_minor_units: 1000,
    raw: null,
    account_id: null,
    ...overrides,
  }
}

describe('computeAccountBalance', () => {
  it('returns the opening balance untouched when the account has no transactions', () => {
    const account = makeAccount({ id: 'a1', opening_balance_minor_units: 5000 })
    const result = computeAccountBalance(account, [])
    expect(result.minorUnits).toBe(5000)
    expect(result.currency).toBe('GBP')
  })

  it('adds income and subtracts outgoing transactions for that account', () => {
    const account = makeAccount({ id: 'a1', opening_balance_minor_units: 10000 })
    const transactions = [
      makeTransaction({ id: 't1', account_id: 'a1', type: 'income', amount_minor_units: 2000 }),
      makeTransaction({ id: 't2', account_id: 'a1', type: 'outgoing', amount_minor_units: 500 }),
    ]
    const result = computeAccountBalance(account, transactions)
    expect(result.minorUnits).toBe(10000 + 2000 - 500)
  })

  it('ignores transactions belonging to a different account', () => {
    const account = makeAccount({ id: 'a1', opening_balance_minor_units: 1000 })
    const transactions = [
      makeTransaction({ id: 't1', account_id: 'a2', type: 'income', amount_minor_units: 999_999 }),
    ]
    const result = computeAccountBalance(account, transactions)
    expect(result.minorUnits).toBe(1000)
  })

  it('falls back to the pounds amount when amount_minor_units is null (manual-entry rows)', () => {
    const account = makeAccount({ id: 'a1', opening_balance_minor_units: 0 })
    const transactions = [
      makeTransaction({ id: 't1', account_id: 'a1', type: 'income', amount: 12.5, amount_minor_units: null }),
    ]
    const result = computeAccountBalance(account, transactions)
    expect(result.minorUnits).toBe(1250)
  })
})

describe('accountNetChangeMinorUnits', () => {
  it('sums only transactions within the period and belonging to the account', () => {
    const account = makeAccount({ id: 'a1' })
    const transactions = [
      makeTransaction({ id: 't1', account_id: 'a1', type: 'income', amount_minor_units: 1000, date: daysAgo(1) }),
      makeTransaction({ id: 't2', account_id: 'a1', type: 'outgoing', amount_minor_units: 300, date: daysAgo(2) }),
      // Outside the 7-day window — excluded.
      makeTransaction({ id: 't3', account_id: 'a1', type: 'income', amount_minor_units: 999_999, date: daysAgo(30) }),
      // Right account_id filter, wrong account — excluded.
      makeTransaction({ id: 't4', account_id: 'a2', type: 'income', amount_minor_units: 999_999, date: daysAgo(1) }),
    ]
    expect(accountNetChangeMinorUnits(account, transactions, 'week')).toBe(1000 - 300)
  })
})

describe('sortAccounts', () => {
  it('puts pinned accounts first, ordered by creation time within each group', () => {
    const accounts = [
      makeAccount({ id: 'unpinned-old', is_pinned: false, created_at: '2026-01-01T00:00:00.000Z' }),
      makeAccount({ id: 'pinned-new', is_pinned: true, created_at: '2026-02-01T00:00:00.000Z' }),
      makeAccount({ id: 'pinned-old', is_pinned: true, created_at: '2026-01-15T00:00:00.000Z' }),
      makeAccount({ id: 'unpinned-new', is_pinned: false, created_at: '2026-03-01T00:00:00.000Z' }),
    ]
    expect(sortAccounts(accounts).map((a) => a.id)).toEqual([
      'pinned-old',
      'pinned-new',
      'unpinned-old',
      'unpinned-new',
    ])
  })

  it('does not mutate the input array', () => {
    const accounts = [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2' })]
    const original = [...accounts]
    sortAccounts(accounts)
    expect(accounts).toEqual(original)
  })
})

describe('computeOverallBalance', () => {
  it('sums balances across accounts and takes the first currency', () => {
    const balances = [
      { account: makeAccount({ id: 'a1' }), minorUnits: 1000, currency: 'GBP' },
      { account: makeAccount({ id: 'a2' }), minorUnits: 2500, currency: 'GBP' },
    ]
    expect(computeOverallBalance(balances)).toEqual({ minorUnits: 3500, currency: 'GBP' })
  })

  it('defaults to 0/GBP with no accounts', () => {
    expect(computeOverallBalance([])).toEqual({ minorUnits: 0, currency: 'GBP' })
  })
})

describe('hasMixedCurrencies', () => {
  it('is false when every account shares one currency', () => {
    const balances = [
      { account: makeAccount({ id: 'a1' }), minorUnits: 100, currency: 'GBP' },
      { account: makeAccount({ id: 'a2' }), minorUnits: 200, currency: 'GBP' },
    ]
    expect(hasMixedCurrencies(balances)).toBe(false)
  })

  it('is true when currencies differ', () => {
    const balances = [
      { account: makeAccount({ id: 'a1' }), minorUnits: 100, currency: 'GBP' },
      { account: makeAccount({ id: 'a2' }), minorUnits: 200, currency: 'USD' },
    ]
    expect(hasMixedCurrencies(balances)).toBe(true)
  })

  it('is false with no accounts', () => {
    expect(hasMixedCurrencies([])).toBe(false)
  })
})

describe('overallNetChangeMinorUnits', () => {
  it('sums transactions across the given accounts only', () => {
    const accounts = [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2' })]
    const transactions = [
      makeTransaction({ id: 't1', account_id: 'a1', type: 'income', amount_minor_units: 1000, date: daysAgo(1) }),
      makeTransaction({ id: 't2', account_id: 'a2', type: 'outgoing', amount_minor_units: 400, date: daysAgo(1) }),
      // Belongs to an account not in the given list — excluded even
      // though it's within the period.
      makeTransaction({ id: 't3', account_id: 'a3', type: 'income', amount_minor_units: 999_999, date: daysAgo(1) }),
    ]
    expect(overallNetChangeMinorUnits(accounts, transactions, 'week')).toBe(1000 - 400)
  })

  it('ignores transactions with no account_id', () => {
    const accounts = [makeAccount({ id: 'a1' })]
    const transactions = [
      makeTransaction({ id: 't1', account_id: null, type: 'income', amount_minor_units: 999_999, date: daysAgo(1) }),
    ]
    expect(overallNetChangeMinorUnits(accounts, transactions, 'week')).toBe(0)
  })
})
