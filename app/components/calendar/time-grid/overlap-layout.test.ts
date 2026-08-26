import { describe, expect, it } from 'vitest'
import { layoutOverlappingBlocks } from './overlap-layout'

function byId(layouts: ReturnType<typeof layoutOverlappingBlocks>, id: string) {
  const found = layouts.find((l) => l.id === id)
  if (!found) throw new Error(`missing layout for ${id}`)
  return found
}

describe('layoutOverlappingBlocks', () => {
  it('gives a single block the full column', () => {
    const result = layoutOverlappingBlocks([{ id: 'a', startMinutes: 60, endMinutes: 120 }])
    expect(result).toEqual([{ id: 'a', column: 0, columnCount: 1 }])
  })

  it('keeps non-overlapping blocks each at full width', () => {
    const result = layoutOverlappingBlocks([
      { id: 'a', startMinutes: 0, endMinutes: 60 },
      { id: 'b', startMinutes: 60, endMinutes: 120 },
      { id: 'c', startMinutes: 200, endMinutes: 260 },
    ])
    for (const id of ['a', 'b', 'c']) {
      expect(byId(result, id).columnCount).toBe(1)
      expect(byId(result, id).column).toBe(0)
    }
  })

  it('splits two overlapping blocks into two side-by-side columns', () => {
    // 09:30-10:30 overlaps 10:00-11:00
    const result = layoutOverlappingBlocks([
      { id: 'write-letter', startMinutes: 570, endMinutes: 630 },
      { id: 'golf-lift', startMinutes: 600, endMinutes: 660 },
    ])
    expect(byId(result, 'write-letter').columnCount).toBe(2)
    expect(byId(result, 'golf-lift').columnCount).toBe(2)
    expect(byId(result, 'write-letter').column).not.toBe(byId(result, 'golf-lift').column)
  })

  it('reuses a freed column for a block that starts after an earlier one ends (chain, not full overlap)', () => {
    // A: 0-60, B: 30-90 (overlaps A), C: 60-120 (starts exactly when A ends,
    // overlaps B) — A and C never overlap each other, so C can reuse A's column.
    const result = layoutOverlappingBlocks([
      { id: 'a', startMinutes: 0, endMinutes: 60 },
      { id: 'b', startMinutes: 30, endMinutes: 90 },
      { id: 'c', startMinutes: 60, endMinutes: 120 },
    ])
    expect(byId(result, 'a').columnCount).toBe(2)
    expect(byId(result, 'b').columnCount).toBe(2)
    expect(byId(result, 'c').columnCount).toBe(2)
    expect(byId(result, 'a').column).toBe(byId(result, 'c').column)
    expect(byId(result, 'b').column).not.toBe(byId(result, 'a').column)
  })

  it('treats back-to-back blocks (end === start) as non-overlapping', () => {
    const result = layoutOverlappingBlocks([
      { id: 'a', startMinutes: 0, endMinutes: 60 },
      { id: 'b', startMinutes: 60, endMinutes: 120 },
    ])
    expect(byId(result, 'a').columnCount).toBe(1)
    expect(byId(result, 'b').columnCount).toBe(1)
  })

  it('gives three mutually-overlapping blocks three equal columns', () => {
    const result = layoutOverlappingBlocks([
      { id: 'a', startMinutes: 0, endMinutes: 90 },
      { id: 'b', startMinutes: 10, endMinutes: 100 },
      { id: 'c', startMinutes: 20, endMinutes: 110 },
    ])
    const columns = new Set(['a', 'b', 'c'].map((id) => byId(result, id).column))
    expect(columns.size).toBe(3)
    for (const id of ['a', 'b', 'c']) expect(byId(result, id).columnCount).toBe(3)
  })

  it('handles an empty input', () => {
    expect(layoutOverlappingBlocks([])).toEqual([])
  })
})
