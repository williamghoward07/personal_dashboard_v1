// Where to put a fixed-position panel next to an anchor element: to its
// right if it fits, else its left, else over it; vertically aligned with
// the anchor's top and clamped inside the viewport. Pure for testing.

export interface Rect {
  top: number
  left: number
  right: number
  bottom: number
}

const GAP = 8
const MARGIN = 12

export function anchorPanelPosition(
  anchor: Rect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number }
): { top: number; left: number } {
  let left: number
  if (anchor.right + GAP + panel.width <= viewport.width - MARGIN) left = anchor.right + GAP
  else if (anchor.left - GAP - panel.width >= MARGIN) left = anchor.left - GAP - panel.width
  else left = viewport.width - MARGIN - panel.width

  const maxTop = viewport.height - MARGIN - panel.height
  const top = Math.max(MARGIN, Math.min(anchor.top, maxTop))
  return { top, left: Math.max(MARGIN, left) }
}
