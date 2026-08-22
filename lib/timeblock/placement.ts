import type { MinuteInterval, PlacementResult, TimeBlockCandidateItem } from './types'

// Greedy first-fit: walks items in the given order (callers pass an
// already-shuffled order — this function has no opinion on ordering) and
// for each, scans gaps chronologically for the first with enough remaining
// room, placing it at that gap's current cursor and advancing the cursor.
// Deliberately dumb by design (v1) — no bin-packing optimisation, no
// re-ordering to minimise waste. Items that fit nowhere land in `unplaced`,
// in their original order, and are never dropped silently.
export function placeItemsIntoGaps(
  gaps: MinuteInterval[],
  items: TimeBlockCandidateItem[],
  durationMinutes: number
): PlacementResult {
  const cursors = gaps.map((gap) => gap.startMinutes)
  const placed: PlacementResult['placed'] = []
  const unplaced: TimeBlockCandidateItem[] = []

  for (const item of items) {
    let placedItem = false
    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i]
      const start = cursors[i]
      if (start + durationMinutes <= gap.endMinutes) {
        placed.push({
          candidate: item,
          startMinutes: start,
          endMinutes: start + durationMinutes,
          gapEndMinutes: gap.endMinutes,
        })
        cursors[i] = start + durationMinutes
        placedItem = true
        break
      }
    }
    if (!placedItem) unplaced.push(item)
  }

  return { placed, unplaced }
}
