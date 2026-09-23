import { describe, expect, it } from 'vitest'
import { clampPage, getPageNumbers, getPageWindow, pageCount, paginate } from './pagination'

describe('pageCount', () => {
  it('divides total items by page size, rounding up', () => {
    expect(pageCount(25, 10)).toBe(3)
    expect(pageCount(20, 10)).toBe(2)
  })

  it('is always at least 1, even with no items', () => {
    expect(pageCount(0, 10)).toBe(1)
  })

  it('is 1 for a non-positive page size', () => {
    expect(pageCount(50, 0)).toBe(1)
    expect(pageCount(50, -5)).toBe(1)
  })
})

describe('clampPage', () => {
  it('clamps below 1 up to 1', () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(-3, 5)).toBe(1)
  })

  it('clamps above pageCount down to pageCount', () => {
    expect(clampPage(9, 5)).toBe(5)
  })

  it('passes through a valid page unchanged', () => {
    expect(clampPage(3, 5)).toBe(3)
  })

  it('truncates a fractional page', () => {
    expect(clampPage(2.9, 5)).toBe(2)
  })

  it('falls back to 1 for a non-finite page', () => {
    expect(clampPage(Number.NaN, 5)).toBe(1)
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1)

  it('returns the first page by default size', () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('returns a middle page', () => {
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  })

  it('returns a partial last page', () => {
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23])
  })

  it('clamps an out-of-range page to the last page', () => {
    expect(paginate(items, 99, 10)).toEqual([21, 22, 23])
  })

  it('clamps a page below 1 to the first page', () => {
    expect(paginate(items, 0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('returns all items unchanged for a non-positive page size', () => {
    expect(paginate(items, 1, 0)).toEqual(items)
  })
})

describe('getPageWindow', () => {
  it('reports no previous on the first page', () => {
    expect(getPageWindow(25, 1, 10)).toEqual({ page: 1, pageCount: 3, hasPrevious: false, hasNext: true })
  })

  it('reports no next on the last page', () => {
    expect(getPageWindow(25, 3, 10)).toEqual({ page: 3, pageCount: 3, hasPrevious: true, hasNext: false })
  })

  it('reports both on a middle page', () => {
    expect(getPageWindow(25, 2, 10)).toEqual({ page: 2, pageCount: 3, hasPrevious: true, hasNext: true })
  })

  it('clamps the reported page when the requested page is out of range', () => {
    expect(getPageWindow(25, 99, 10)).toEqual({ page: 3, pageCount: 3, hasPrevious: true, hasNext: false })
  })

  it('single page has neither previous nor next', () => {
    expect(getPageWindow(5, 1, 10)).toEqual({ page: 1, pageCount: 1, hasPrevious: false, hasNext: false })
  })
})

describe('getPageNumbers', () => {
  it('shows every page when the total fits with no ellipsis', () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('shows a right ellipsis when near the start', () => {
    expect(getPageNumbers(1, 12)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 12])
  })

  it('shows a left ellipsis when near the end', () => {
    expect(getPageNumbers(12, 12)).toEqual([1, 'ellipsis', 8, 9, 10, 11, 12])
  })

  it('shows both ellipses when in the middle', () => {
    expect(getPageNumbers(6, 12)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 12])
  })

  it('clamps an out-of-range current page before windowing', () => {
    expect(getPageNumbers(99, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('respects a wider siblingCount', () => {
    expect(getPageNumbers(6, 20, 2)).toEqual([1, 'ellipsis', 4, 5, 6, 7, 8, 'ellipsis', 20])
  })
})
