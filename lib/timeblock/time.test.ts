import { describe, expect, it } from 'vitest'
import { formatHHmm, parseHHmm, resolveWindow, splitDayOffset } from './time'

describe('parseHHmm / formatHHmm', () => {
  it('round-trips a normal time', () => {
    expect(parseHHmm('07:30')).toBe(450)
    expect(formatHHmm(450)).toBe('07:30')
  })

  it('wraps minutes past 1440 back into the 0-23:59 range', () => {
    expect(formatHHmm(1470)).toBe('00:30') // 1440 + 30
  })
})

describe('resolveWindow', () => {
  it('keeps a same-day window when bedtime is after wake time', () => {
    expect(resolveWindow('07:00', '23:00')).toEqual({ startMinutes: 420, endMinutes: 1380 })
  })

  it('rolls bedtime into the next day when it is at or before wake time', () => {
    expect(resolveWindow('07:00', '00:30')).toEqual({ startMinutes: 420, endMinutes: 1470 })
  })

  it('rolls over when bedtime exactly equals wake time', () => {
    expect(resolveWindow('07:00', '07:00')).toEqual({ startMinutes: 420, endMinutes: 1860 })
  })
})

describe('splitDayOffset', () => {
  it('stays on day 0 below the 1440 boundary', () => {
    expect(splitDayOffset(1439)).toEqual({ dayOffset: 0, time: '23:59' })
  })

  it('rolls onto day 1 at exactly 1440', () => {
    expect(splitDayOffset(1440)).toEqual({ dayOffset: 1, time: '00:00' })
  })

  it('rolls onto day 1 above the boundary', () => {
    expect(splitDayOffset(1470)).toEqual({ dayOffset: 1, time: '00:30' })
  })
})
