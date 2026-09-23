import { describe, expect, it } from 'vitest'
import {
  activeNavItem,
  canHideNavItem,
  isNavItemActive,
  isNavItemVisible,
  navItems,
  setNavItemVisibility,
  showOverrideToken,
  visibleNavItems,
  type NavItem,
} from './nav-items'

const byHref = (href: string): NavItem => {
  const item = navItems.find((entry) => entry.href === href)
  if (!item) throw new Error(`no nav item for ${href}`)
  return item
}

describe('isNavItemActive', () => {
  it('matches home only exactly', () => {
    expect(isNavItemActive(byHref('/'), '/')).toBe(true)
    expect(isNavItemActive(byHref('/'), '/money')).toBe(false)
  })

  it('matches a section by prefix', () => {
    expect(isNavItemActive(byHref('/workspaces'), '/workspaces/abc-123')).toBe(true)
    expect(isNavItemActive(byHref('/workspaces'), '/money')).toBe(false)
  })
})

describe('activeNavItem', () => {
  it('resolves a nested route to its section', () => {
    expect(activeNavItem('/workspaces/abc-123')?.label).toBe('Workspaces')
  })

  it('returns null for a route with no tab', () => {
    expect(activeNavItem('/login')).toBeNull()
    expect(activeNavItem('/design-system-test')).toBeNull()
  })
})

describe('visibility defaults', () => {
  it('shows every ordinary item when nothing is stored', () => {
    expect(isNavItemVisible(byHref('/money'), [])).toBe(true)
  })

  it('hides the default-hidden routes when nothing is stored', () => {
    expect(isNavItemVisible(byHref('/todos'), [])).toBe(false)
    expect(isNavItemVisible(byHref('/ai-usage'), [])).toBe(false)
    expect(visibleNavItems([]).map((i) => i.href)).not.toContain('/todos')
  })

  it('never hides home, whatever is stored', () => {
    expect(canHideNavItem(byHref('/'))).toBe(false)
    expect(isNavItemVisible(byHref('/'), ['/'])).toBe(true)
    expect(visibleNavItems(['/'])[0].href).toBe('/')
  })
})

describe('setNavItemVisibility', () => {
  it('hides an ordinary item by storing its href', () => {
    const next = setNavItemVisibility([], byHref('/bible'), false)
    expect(next).toEqual(['/bible'])
    expect(isNavItemVisible(byHref('/bible'), next)).toBe(false)
  })

  it('re-showing an ordinary item removes the entry rather than adding one', () => {
    const next = setNavItemVisibility(['/bible'], byHref('/bible'), true)
    expect(next).toEqual([])
  })

  it('shows a default-hidden item with a show: token', () => {
    const next = setNavItemVisibility([], byHref('/todos'), true)
    expect(next).toEqual([showOverrideToken('/todos')])
    expect(isNavItemVisible(byHref('/todos'), next)).toBe(true)
    expect(visibleNavItems(next).map((i) => i.href)).toContain('/todos')
  })

  it('re-hiding a default-hidden item drops the token', () => {
    const shown = setNavItemVisibility([], byHref('/todos'), true)
    expect(setNavItemVisibility(shown, byHref('/todos'), false)).toEqual([])
  })

  it('never leaves a contradictory pair for one href', () => {
    const messy = ['/todos', showOverrideToken('/todos'), '/bible']
    const next = setNavItemVisibility(messy, byHref('/todos'), true)
    expect(next.filter((entry) => entry.includes('/todos'))).toEqual([showOverrideToken('/todos')])
    expect(next).toContain('/bible')
  })

  it('is a no-op for home', () => {
    expect(setNavItemVisibility(['/bible'], byHref('/'), false)).toEqual(['/bible'])
  })

  it('tolerates unknown stored entries from an older build', () => {
    expect(visibleNavItems(['/retired-route', 'show:/gone']).length).toBe(
      navItems.filter((i) => !i.hiddenByDefault).length
    )
  })
})
