import { describe, expect, it } from 'vitest'
import { dueCountFact, transactionFacts, type FactTransaction } from './facts'
import { resolveTimeWindow } from './time-window'

const window = resolveTimeWindow('this_month', new Date('2026-11-18T12:00:00Z'))

function row(over: Partial<FactTransaction>): FactTransaction {
  return { amount: null, amount_minor_units: null, type: 'outgoing', date: '2026-11-02', source: 'manual', raw: null, ...over }
}

describe('transactionFacts', () => {
  it('sums spending in pence, falling back to pounds for manual rows', () => {
    const rows = [row({ amount_minor_units: 1250 }), row({ amount: 70.1 }), row({ amount_minor_units: 1 })]
    expect(transactionFacts(rows, ['food'], window)).toEqual([
      "Spending matching 'food' in this month (1–30 Nov 2026): £82.61 across 3 transactions.",
    ])
  })
  it('reports income separately', () => {
    const rows = [row({ amount_minor_units: 500 }), row({ amount_minor_units: 20000, type: 'income' })]
    expect(transactionFacts(rows, [], window)).toEqual([
      'Spending in this month (1–30 Nov 2026): £5.00 across 1 transaction.',
      'Income in this month (1–30 Nov 2026): £200.00 across 1 transaction.',
    ])
  })
  it('excludes declined starling rows', () => {
    const rows = [
      row({ amount_minor_units: 500, source: 'starling', raw: { status: 'DECLINED' } }),
      row({ amount_minor_units: 300, source: 'starling', raw: { status: 'SETTLED' } }),
    ]
    expect(transactionFacts(rows, ['food'], null)).toEqual(["Spending matching 'food': £3.00 across 1 transaction."])
  })
  it('says at least when capped', () => {
    expect(transactionFacts([row({ amount_minor_units: 100 })], ['a', 'b'], null, true)).toEqual([
      "Spending matching 'a' or 'b': at least £1.00 across at least 1 transaction.",
    ])
  })
  it('handles no rows', () => {
    expect(transactionFacts([], ['food'], window)).toEqual(["No transactions found matching 'food' in this month (1–30 Nov 2026)."])
  })
})

describe('dueCountFact', () => {
  const week = resolveTimeWindow('this_week', new Date('2026-11-18T12:00:00Z'))
  it('counts open items', () => {
    expect(dueCountFact('todo', 3, [], week)).toBe('3 open todos due in this week (16–22 Nov 2026).')
    expect(dueCountFact('task', 1, ['essay'], week)).toBe("1 open task matching 'essay' due in this week (16–22 Nov 2026).")
  })
  it('says at least when capped', () => {
    expect(dueCountFact('todo', 25, [], week, true)).toBe('At least 25 open todos due in this week (16–22 Nov 2026).')
  })
})
