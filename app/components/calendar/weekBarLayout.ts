import type { EventSpan } from './calendarItems'

export interface PlacedBar {
  id: string
  title: string
  colStart: number // 0-indexed column within the week (0=Mon..6=Sun)
  colSpan: number
  lane: number
}

// Greedily assigns each span to the lowest lane whose occupied columns
// (in this week) don't overlap it, so simultaneous multi-day events stack
// instead of colliding. Spans outside this week's columns (weekCells[i]
// null, or the span doesn't reach any of these dates) are dropped — that's
// also how month view naturally clips a bar at the visible month's edges,
// since out-of-month cells are null.
export function layoutBarsForWeek(weekCells: (string | null)[], spans: EventSpan[]): PlacedBar[] {
  const placed: PlacedBar[] = []

  for (const span of spans) {
    let colStart = -1
    let colEnd = -1
    weekCells.forEach((key, idx) => {
      if (key && key >= span.startKey && key <= span.endKey) {
        if (colStart === -1) colStart = idx
        colEnd = idx
      }
    })
    if (colStart === -1) continue

    let lane = 0
    while (placed.some((p) => p.lane === lane && colStart <= p.colStart + p.colSpan - 1 && colEnd >= p.colStart)) {
      lane++
    }

    placed.push({ id: span.id, title: span.title, colStart, colSpan: colEnd - colStart + 1, lane })
  }

  return placed
}

export function laneCountForWeek(placedBars: PlacedBar[]): number {
  return placedBars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0)
}
