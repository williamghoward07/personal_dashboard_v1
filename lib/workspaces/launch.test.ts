import { describe, expect, it } from 'vitest'
import { launchLinks, openOne } from './launch'

// A fake pop-up blocker: lets the first `allowed` opens through, blocks the rest.
function fakeOpen(allowed: number) {
  const calls: string[] = []
  const tabs: { opener: unknown }[] = []
  const open = (url: string) => {
    calls.push(url)
    if (calls.length > allowed) return null
    const tab = { opener: 'parent' }
    tabs.push(tab)
    return tab as unknown as Window
  }
  return { open, calls, tabs }
}

describe('launchLinks', () => {
  it('opens every link when nothing is blocked', () => {
    const { open, calls, tabs } = fakeOpen(10)
    const result = launchLinks(['a', 'b', 'c'], open)
    expect(result).toEqual({ opened: 3, blocked: [] })
    expect(calls).toEqual(['a', 'b', 'c'])
    expect(tabs.every((t) => t.opener === null)).toBe(true)
  })

  it('reports the links a pop-up blocker stopped, in order', () => {
    const { open } = fakeOpen(1)
    expect(launchLinks(['a', 'b', 'c'], open)).toEqual({ opened: 1, blocked: ['b', 'c'] })
  })

  it('handles an empty set', () => {
    const { open } = fakeOpen(1)
    expect(launchLinks([], open)).toEqual({ opened: 0, blocked: [] })
  })
})

describe('openOne', () => {
  it('returns false when blocked', () => {
    const { open } = fakeOpen(0)
    expect(openOne('a', open)).toBe(false)
  })
})
