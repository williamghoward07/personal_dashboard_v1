import type { HomeWidgetSpan } from '@/lib/settings/schema'

export const MIN_LAUNCHER_ROWS = 2
export const MAX_LAUNCHER_ROWS = 12
export const LAUNCHER_TILE_HEIGHT = 80
export const LAUNCHER_TILE_GAP = 8
export const LAUNCHER_ROW_STEP = LAUNCHER_TILE_HEIGHT + LAUNCHER_TILE_GAP

// Legacy layouts stored the card's pixel height. Use the nearest row count
// and keep saving the corresponding height in the existing layout field.
// The card chrome is 2px border + 48px padding + 20px header + 12px gap.
const TWO_ROW_CARD_HEIGHT = 82 + 2 * LAUNCHER_TILE_HEIGHT + LAUNCHER_TILE_GAP

export function clampLauncherRows(rows: number): number {
  return Math.min(MAX_LAUNCHER_ROWS, Math.max(MIN_LAUNCHER_ROWS, rows))
}

export function launcherRowsForHeight(height: number | undefined): number {
  return height === undefined
    ? MIN_LAUNCHER_ROWS
    : clampLauncherRows(MIN_LAUNCHER_ROWS + Math.round((height - TWO_ROW_CARD_HEIGHT) / LAUNCHER_ROW_STEP))
}

export function launcherHeightForRows(rows: number): number | undefined {
  return rows === MIN_LAUNCHER_ROWS ? undefined : TWO_ROW_CARD_HEIGHT + (rows - MIN_LAUNCHER_ROWS) * LAUNCHER_ROW_STEP
}

export function launcherColumns(span: HomeWidgetSpan, width: number): number {
  // 64px tiles (labels ellipsise) fit four across a ~340px phone card.
  const tileWidth = 64
  const columnsThatFit = Math.floor((width + LAUNCHER_TILE_GAP) / (tileWidth + LAUNCHER_TILE_GAP))
  return Math.max(1, Math.min(span * 4, columnsThatFit))
}

export function stepLauncherSpan(span: HomeWidgetSpan, step: number, gridColumns: number): HomeWidgetSpan {
  const current = Math.min(span, gridColumns)
  const next = Math.min(gridColumns, Math.max(1, current + step)) as HomeWidgetSpan
  // A vertical drag on a narrow layout should preserve the saved desktop width.
  return next === current ? span : next
}
