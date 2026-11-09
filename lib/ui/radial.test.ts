import { describe, expect, it } from 'vitest'
import { radialIndex, radialPosition } from './radial'

describe('radialPosition', () => {
  it('puts the first item at 12 o’clock and goes clockwise', () => {
    expect(radialPosition(0, 4, 10)).toEqual({ x: 0, y: -10 })
    expect(radialPosition(1, 4, 10)).toEqual({ x: 10, y: 0 })
    expect(radialPosition(2, 4, 10)).toEqual({ x: 0, y: 10 })
    expect(radialPosition(3, 4, 10)).toEqual({ x: -10, y: 0 })
  })
})

describe('radialIndex', () => {
  it('cancels inside the dead zone', () => {
    expect(radialIndex(3, 3, 4, 10)).toBeNull()
  })

  it('picks the slice the pointer is in', () => {
    expect(radialIndex(0, -50, 4, 10)).toBe(0)
    expect(radialIndex(50, 0, 4, 10)).toBe(1)
    expect(radialIndex(0, 50, 4, 10)).toBe(2)
    expect(radialIndex(-50, 0, 4, 10)).toBe(3)
  })

  it('centres each slice on its item, so just left of 12 o’clock is still item 0', () => {
    expect(radialIndex(-5, -50, 4, 10)).toBe(0)
    expect(radialIndex(-50, -45, 4, 10)).toBe(3)
  })

  it('agrees with radialPosition for every item', () => {
    for (let i = 0; i < 7; i++) {
      const { x, y } = radialPosition(i, 7, 60)
      expect(radialIndex(x, y, 7, 20)).toBe(i)
    }
  })

  it('returns null with no items', () => {
    expect(radialIndex(50, 0, 0, 10)).toBeNull()
  })
})
