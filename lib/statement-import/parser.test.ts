import { describe, it, expect } from 'vitest'
import { parseStatementText } from './parser'

const YEAR = 2026

describe('parseStatementText', () => {
  it('parses a slash-formatted date and a plain amount, defaulting to outgoing', () => {
    const [candidate] = parseStatementText('05/08/2026 TESCO STORES 45.00', YEAR)
    expect(candidate.date).toBe('2026-08-05')
    expect(candidate.amount).toBe(45)
    expect(candidate.type).toBe('outgoing')
    expect(candidate.description).toBe('TESCO STORES')
  })

  it('parses a hyphen-formatted date', () => {
    const [candidate] = parseStatementText('05-08-2026 TESCO STORES 45.00', YEAR)
    expect(candidate.date).toBe('2026-08-05')
  })

  it('parses a month-name date with an explicit year', () => {
    const [candidate] = parseStatementText('5 Aug 2026 SALARY 1,234.56', YEAR)
    expect(candidate.date).toBe('2026-08-05')
    expect(candidate.amount).toBe(1234.56)
  })

  it('falls back to statementYear when the line has no year of its own', () => {
    const [candidate] = parseStatementText('5 Aug SALARY 1234.56', 2025)
    expect(candidate.date).toBe('2025-08-05')
  })

  it('expands a 2-digit year', () => {
    const [candidate] = parseStatementText('05/08/26 TESCO STORES 45.00', YEAR)
    expect(candidate.date).toBe('2026-08-05')
  })

  it('treats an explicit minus sign as outgoing and strips it from the amount', () => {
    const [candidate] = parseStatementText('05/08/2026 TESCO STORES -45.00', YEAR)
    expect(candidate.amount).toBe(45)
    expect(candidate.type).toBe('outgoing')
  })

  it('treats a parenthesised amount as outgoing', () => {
    const [candidate] = parseStatementText('05/08/2026 TESCO STORES (45.00)', YEAR)
    expect(candidate.amount).toBe(45)
    expect(candidate.type).toBe('outgoing')
  })

  it('treats an explicit plus sign as income', () => {
    const [candidate] = parseStatementText('05/08/2026 SALARY +1500.00', YEAR)
    expect(candidate.amount).toBe(1500)
    expect(candidate.type).toBe('income')
  })

  it('takes the first amount when a line has two (transaction + running balance)', () => {
    const [candidate] = parseStatementText('05/08/2026 TESCO STORES -45.00 1,234.56', YEAR)
    expect(candidate.amount).toBe(45)
    expect(candidate.type).toBe('outgoing')
    // The running-balance token is stripped from the description too,
    // since it's just the second amount match on the same line.
    expect(candidate.description).toBe('TESCO STORES')
  })

  it('skips a line with a date but no amount', () => {
    expect(parseStatementText('05/08/2026 Statement period begins', YEAR)).toEqual([])
  })

  it('skips a line with an amount but no date', () => {
    expect(parseStatementText('Closing balance 1,234.56', YEAR)).toEqual([])
  })

  it('skips blank lines', () => {
    expect(parseStatementText('\n   \n\t\n', YEAR)).toEqual([])
  })

  it('parses every valid line in a multi-line statement, in order', () => {
    const text = [
      '05/08/2026 TESCO STORES -45.00',
      'Statement period: 01/08/2026 to 31/08/2026',
      '06/08/2026 SALARY +1500.00',
      '07/08/2026 COFFEE SHOP -3.50',
    ].join('\n')

    const candidates = parseStatementText(text, YEAR)
    expect(candidates).toHaveLength(3)
    expect(candidates.map((c) => c.description)).toEqual(['TESCO STORES', 'SALARY', 'COFFEE SHOP'])
  })

  it('falls back to a placeholder description when nothing is left after stripping tokens', () => {
    const [candidate] = parseStatementText('05/08/2026 45.00', YEAR)
    expect(candidate.description).toBe('Statement transaction')
  })
})
