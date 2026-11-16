import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@/lib/settings/schema'
import { navItems, visibleNavItems } from '@/lib/nav-items'
import MobileBottomNav from './MobileBottomNav'
import SettingsProvider from './settings/SettingsProvider'

const state = vi.hoisted(() => ({ pathname: '/lectures', hidden: null as string[] | null }))

vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))

vi.mock('@/lib/settings/use-settings', async () => {
  const { defaultSettings } = await import('@/lib/settings/schema')
  return {
    useSettings: () => ({
      settings: {
        ...defaultSettings(),
        ...(state.hidden ? { hidden_nav_items: state.hidden } : {}),
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
      updateSettings: vi.fn(),
    }),
  }
})

function renderNav() {
  return render(<SettingsProvider><MobileBottomNav /></SettingsProvider>)
}

describe('MobileBottomNav', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })
  afterEach(() => {
    cleanup()
    state.pathname = '/lectures'
    state.hidden = null
  })

  const all = visibleNavItems(defaultSettings().hidden_nav_items)

  it('shows 4 items plus More when there are more than 5', () => {
    expect(all.length).toBeGreaterThan(5)
    renderNav()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.className).toContain('env(safe-area-inset-bottom)')
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(within(nav).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /More/ })).toBeTruthy()
    const first = screen.getByRole('link', { name: all[0].label })
    expect(first.className).toContain('flex-1')
    expect(first.className).toContain('h-16')
    expect(first.querySelector('span')?.className).toContain('text-xs')
  })

  it('shows every item with no More when there are 5 or fewer', () => {
    state.hidden = navItems.filter((i) => !all.slice(0, 5).includes(i)).map((i) => i.href)
    renderNav()
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /More/ })).toBeNull()
  })

  it('marks the active bar tab with aria-current', () => {
    state.pathname = all[1].href
    renderNav()
    expect(screen.getByRole('link', { name: all[1].label }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /More/ }).className).toContain('text-on-surface-variant')
  })

  it('highlights More when the route is an overflow item', () => {
    state.pathname = all[6].href
    renderNav()
    expect(screen.getAllByRole('link').every((l) => !l.getAttribute('aria-current'))).toBe(true)
    expect(screen.getByRole('button', { name: /More/ }).className).not.toContain('text-on-surface-variant')
  })

  it('opens a sheet with the overflow items and closes on selection, close and Escape', () => {
    renderNav()
    const more = screen.getByRole('button', { name: /More/ })
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
    fireEvent.click(more)
    const sheet = screen.getByRole('dialog', { name: 'More' })
    const rows = within(sheet).getAllByRole('link')
    expect(rows.map((r) => r.textContent)).toEqual(all.slice(4).map((i) => i.label))

    fireEvent.click(rows[0])
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull()
    expect(document.activeElement).toBe(more)

    fireEvent.click(more)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull()

    fireEvent.click(more)
    fireEvent(screen.getByRole('dialog', { name: 'More' }), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull()
  })
})
