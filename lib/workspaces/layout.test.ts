import { describe, expect, it } from 'vitest'
import { columnLayout, isShown, toggleSection, visibleStatCards } from './layout'

describe('visibleStatCards', () => {
  it('shows all four cards by default', () => {
    expect(visibleStatCards([])).toEqual(['tasks', 'footprint', 'coupling', 'log'])
  })

  it('drops cards whose sections are hidden', () => {
    // e.g. a side project with only sources + log
    expect(visibleStatCards(['actions'])).toEqual(['footprint', 'log'])
    expect(visibleStatCards(['sources'])).toEqual(['tasks', 'log'])
    expect(visibleStatCards(['log'])).toEqual(['tasks', 'footprint', 'coupling'])
  })

  it('shows nothing when stats are hidden', () => {
    expect(visibleStatCards(['stats'])).toEqual([])
  })
})

describe('columnLayout', () => {
  it('splits shown columns into expanded and collapsed', () => {
    expect(columnLayout(['actions'], ['log'])).toEqual({ expanded: ['sources'], collapsed: ['log'] })
  })

  it('ignores a collapsed flag on a hidden section', () => {
    expect(columnLayout(['log'], ['log'])).toEqual({ expanded: ['sources', 'actions'], collapsed: [] })
  })

  it('ignores stats (not a column)', () => {
    expect(columnLayout([], ['stats'])).toEqual({ expanded: ['sources', 'actions', 'log'], collapsed: [] })
  })
})

describe('toggleSection / isShown', () => {
  it('adds and removes keys in canonical order', () => {
    expect(toggleSection(['log'], 'stats')).toEqual(['stats', 'log'])
    expect(toggleSection(['stats', 'log'], 'stats')).toEqual(['log'])
  })

  it('reports visibility', () => {
    expect(isShown(['log'], 'log')).toBe(false)
    expect(isShown(['log'], 'sources')).toBe(true)
  })
})
