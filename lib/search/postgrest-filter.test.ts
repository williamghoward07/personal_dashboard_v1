import { describe, it, expect } from 'vitest'
import { escapePostgrestFilterValue, ilikeAnyColumn } from './postgrest-filter'

describe('escapePostgrestFilterValue', () => {
  it('wraps a plain value in double quotes', () => {
    expect(escapePostgrestFilterValue('%hello%')).toBe('"%hello%"')
  })

  it('escapes an embedded double quote', () => {
    expect(escapePostgrestFilterValue('%say "hi"%')).toBe('"%say \\"hi\\"%"')
  })

  it('leaves structural characters (comma, period, parens) untouched inside the quotes', () => {
    expect(escapePostgrestFilterValue('%a,b.c(d)%')).toBe('"%a,b.c(d)%"')
  })
})

describe('ilikeAnyColumn', () => {
  it('produces one ilike clause per column-keyword pair, comma-joined', () => {
    const result = ilikeAnyColumn(['title', 'notes'], ['foo', 'bar'])
    expect(result).toBe('title.ilike."%foo%",title.ilike."%bar%",notes.ilike."%foo%",notes.ilike."%bar%"')
  })

  it('returns an empty string for no columns or no keywords', () => {
    expect(ilikeAnyColumn([], ['foo'])).toBe('')
    expect(ilikeAnyColumn(['title'], [])).toBe('')
  })

  it('keeps a comma inside a keyword from being parsed as a condition separator', () => {
    const result = ilikeAnyColumn(['title'], ['salt, pepper'])
    // Exactly one clause — the embedded comma stays inside the quoted
    // value rather than splitting this into two conditions.
    expect(result).toBe('title.ilike."%salt, pepper%"')
    expect(result.split('.ilike.')).toHaveLength(2)
  })

  it('single column, single keyword', () => {
    expect(ilikeAnyColumn(['full_name'], ['Alice'])).toBe('full_name.ilike."%Alice%"')
  })
})
