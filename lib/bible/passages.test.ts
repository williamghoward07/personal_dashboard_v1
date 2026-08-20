import { describe, expect, it } from 'vitest'
import { formatReference } from './passages'

describe('formatReference', () => {
  it('formats a whole-chapter reference with no verse numbers', () => {
    expect(formatReference({ book: 'Psalms', chapter: 23, verse_start: null, verse_end: null })).toBe('Psalms 23')
  })

  it('formats a single verse', () => {
    expect(formatReference({ book: 'John', chapter: 3, verse_start: 16, verse_end: null })).toBe('John 3:16')
  })

  it('formats a single verse when verse_end equals verse_start', () => {
    expect(formatReference({ book: 'John', chapter: 3, verse_start: 16, verse_end: 16 })).toBe('John 3:16')
  })

  it('formats a verse range', () => {
    expect(formatReference({ book: 'Romans', chapter: 8, verse_start: 1, verse_end: 17 })).toBe('Romans 8:1-17')
  })
})
