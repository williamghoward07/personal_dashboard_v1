import { describe, expect, it } from 'vitest'
import { columnLayout, isShown, toggleSection, visibleStatCards } from './layout'

describe('visibleStatCards', () => {
  it('shows every card when nothing is hidden', () => {
    expect(visibleStatCards([])).toEqual(['time', 'tasks', 'footprint', 'coupling', 'log'])
  })

  it('shows the original four on a workspace without study sections', () => {
    expect(visibleStatCards(['readings', 'time'])).toEqual(['tasks', 'footprint', 'coupling', 'log'])
  })

  it('drops cards whose sections are hidden', () => {
    // e.g. a side project with only sources + log
    expect(visibleStatCards(['actions', 'time'])).toEqual(['footprint', 'log'])
    expect(visibleStatCards(['sources', 'time'])).toEqual(['tasks', 'log'])
    expect(visibleStatCards(['log', 'time'])).toEqual(['tasks', 'footprint', 'coupling'])
  })

  it('shows nothing when stats are hidden', () => {
    expect(visibleStatCards(['stats'])).toEqual([])
  })
})

describe('columnLayout', () => {
  it('splits shown columns into expanded and collapsed', () => {
    expect(columnLayout(['actions', 'readings'], ['log'])).toEqual({ expanded: ['sources'], collapsed: ['log'] })
    expect(columnLayout([], [])).toEqual({ expanded: ['sources', 'readings', 'actions', 'log'], collapsed: [] })
  })

  it('ignores a collapsed flag on a hidden section', () => {
    expect(columnLayout(['log', 'readings'], ['log'])).toEqual({ expanded: ['sources', 'actions'], collapsed: [] })
  })

  it('ignores stats and time (not columns)', () => {
    expect(columnLayout(['readings'], ['stats', 'time'])).toEqual({
      expanded: ['sources', 'actions', 'log'],
      collapsed: [],
    })
  })
})

describe('toggleSection / isShown', () => {
  it('adds and removes keys in canonical order', () => {
    expect(toggleSection(['log'], 'stats')).toEqual(['stats', 'log'])
    expect(toggleSection(['stats', 'log'], 'stats')).toEqual(['log'])
    expect(toggleSection(['readings', 'time'], 'readings')).toEqual(['time'])
  })

  it('reports visibility', () => {
    expect(isShown(['log'], 'log')).toBe(false)
    expect(isShown(['log'], 'sources')).toBe(true)
  })
})
