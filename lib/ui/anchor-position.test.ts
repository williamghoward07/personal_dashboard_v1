import { describe, expect, it } from 'vitest'
import { anchorPanelPosition } from './anchor-position'

const viewport = { width: 1440, height: 900 }
const panel = { width: 360, height: 400 }

describe('anchorPanelPosition', () => {
  it('opens to the right when there is room', () => {
    expect(anchorPanelPosition({ top: 100, left: 200, right: 300, bottom: 130 }, panel, viewport)).toEqual({
      top: 100,
      left: 308,
    })
  })

  it('flips to the left near the right edge', () => {
    expect(anchorPanelPosition({ top: 100, left: 1200, right: 1300, bottom: 130 }, panel, viewport).left).toBe(832)
  })

  it('clamps vertically inside the viewport', () => {
    expect(anchorPanelPosition({ top: 800, left: 200, right: 300, bottom: 830 }, panel, viewport).top).toBe(488)
  })

  it('stays on screen when neither side fits', () => {
    const narrow = { width: 400, height: 900 }
    expect(anchorPanelPosition({ top: 10, left: 50, right: 350, bottom: 40 }, panel, narrow).left).toBe(28)
  })
})
