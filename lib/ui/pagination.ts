// Pure page-window logic for DESIGN.md §4.8's pagination control (the
// Instagram Follows table). No React, no Supabase — same house style as
// lib/app-launcher/order.ts. A component pairs this with static Tailwind
// classes for the "current page inverted" look; the maths lives here so it
// has a colocated test instead of being buried in JSX.

/** Total pages for `totalItems` at `pageSize`. Always at least 1. */
export function pageCount(totalItems: number, pageSize: number): number {
  if (pageSize <= 0 || totalItems <= 0) return 1
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

/** Clamps a requested page into `[1, pageCount]` — e.g. after a filter shrinks the result set. */
export function clampPage(page: number, count: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, count))
}

/** The slice of `items` shown on `page` (1-indexed), already clamped. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) return items.slice()
  const count = pageCount(items.length, pageSize)
  const current = clampPage(page, count)
  const start = (current - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export interface PageWindow {
  page: number
  pageCount: number
  hasPrevious: boolean
  hasNext: boolean
}

/** Everything a pagination control needs to render its prev/next affordances. */
export function getPageWindow(totalItems: number, page: number, pageSize: number): PageWindow {
  const count = pageCount(totalItems, pageSize)
  const current = clampPage(page, count)
  return {
    page: current,
    pageCount: count,
    hasPrevious: current > 1,
    hasNext: current < count,
  }
}

const ELLIPSIS = 'ellipsis' as const
export type PageToken = number | typeof ELLIPSIS

/**
 * Windowed page numbers for a `1 2 … 5 6 7 … 12` style control — always
 * shows the first and last page, plus a run of `siblingCount` pages either
 * side of `page`, collapsing any gap wider than one page into a single
 * ellipsis token.
 */
export function getPageNumbers(page: number, count: number, siblingCount = 1): PageToken[] {
  const current = clampPage(page, count)
  const totalNumbers = siblingCount * 2 + 5 // first, last, current, 2 ellipses
  if (count <= totalNumbers) {
    return Array.from({ length: count }, (_, i) => i + 1)
  }

  const leftSibling = Math.max(current - siblingCount, 1)
  const rightSibling = Math.min(current + siblingCount, count)

  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < count - 1

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1)
    return [...leftRange, ELLIPSIS, count]
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2
    const rightRange = Array.from({ length: rightCount }, (_, i) => count - rightCount + i + 1)
    return [1, ELLIPSIS, ...rightRange]
  }

  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i)
  return [1, ELLIPSIS, ...middleRange, ELLIPSIS, count]
}
