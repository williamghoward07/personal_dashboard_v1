import { describe, expect, it } from 'vitest'
import { placeItemsIntoGaps } from './placement'
import type { TimeBlockCandidateItem } from './types'

function item(id: string, title = id): TimeBlockCandidateItem {
  return { id, source: 'todo', title }
}

describe('placeItemsIntoGaps', () => {
  it('packs items into a single gap chronologically', () => {
    const gaps = [{ startMinutes: 0, endMinutes: 100 }]
    const { placed, unplaced } = placeItemsIntoGaps(gaps, [item('a'), item('b')], 30)

    expect(unplaced).toEqual([])
    expect(placed).toEqual([
      { candidate: item('a'), startMinutes: 0, endMinutes: 30, gapEndMinutes: 100 },
      { candidate: item('b'), startMinutes: 30, endMinutes: 60, gapEndMinutes: 100 },
    ])
  })

  it('moves to the next gap once the current one is full', () => {
    const gaps = [
      { startMinutes: 0, endMinutes: 40 },
      { startMinutes: 100, endMinutes: 200 },
    ]
    const { placed } = placeItemsIntoGaps(gaps, [item('a'), item('b')], 30)

    expect(placed[0]).toMatchObject({ startMinutes: 0, gapEndMinutes: 40 })
    expect(placed[1]).toMatchObject({ startMinutes: 100, gapEndMinutes: 200 })
  })

  it('reports items that fit nowhere as unplaced, in original order', () => {
    const gaps = [{ startMinutes: 0, endMinutes: 20 }]
    const { placed, unplaced } = placeItemsIntoGaps(gaps, [item('a'), item('b'), item('c')], 30)

    expect(placed).toEqual([])
    expect(unplaced.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('places what fits and leaves the rest unplaced', () => {
    const gaps = [{ startMinutes: 0, endMinutes: 50 }]
    const { placed, unplaced } = placeItemsIntoGaps(gaps, [item('a'), item('b')], 30)

    expect(placed.map((p) => p.candidate.id)).toEqual(['a'])
    expect(unplaced.map((i) => i.id)).toEqual(['b'])
  })
})
