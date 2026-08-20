import { describe, expect, it } from 'vitest'
import { BIBLE_BOOKS, bookOrderOf, isValidBookName } from './books'

describe('BIBLE_BOOKS', () => {
  it('has exactly 66 books', () => {
    expect(BIBLE_BOOKS).toHaveLength(66)
  })

  it('orders 1-66 with no gaps or duplicates', () => {
    const orders = BIBLE_BOOKS.map((b) => b.order).sort((a, b) => a - b)
    expect(orders).toEqual(Array.from({ length: 66 }, (_, i) => i + 1))
  })

  it('splits 39 Old Testament / 27 New Testament books', () => {
    expect(BIBLE_BOOKS.filter((b) => b.testament === 'old')).toHaveLength(39)
    expect(BIBLE_BOOKS.filter((b) => b.testament === 'new')).toHaveLength(27)
  })
})

describe('isValidBookName', () => {
  it('accepts a canonical name', () => {
    expect(isValidBookName('Romans')).toBe(true)
  })

  it('rejects an unknown or misspelled name', () => {
    expect(isValidBookName('Romanss')).toBe(false)
    expect(isValidBookName('')).toBe(false)
  })
})

describe('bookOrderOf', () => {
  it('returns the canonical order for a known book', () => {
    expect(bookOrderOf('Genesis')).toBe(1)
    expect(bookOrderOf('Revelation')).toBe(66)
    expect(bookOrderOf('Romans')).toBe(45)
  })

  it('returns null for an unknown book', () => {
    expect(bookOrderOf('Not A Book')).toBeNull()
  })
})
