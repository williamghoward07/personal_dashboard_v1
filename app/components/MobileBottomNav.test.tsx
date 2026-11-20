import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileBottomNav from './MobileBottomNav'

vi.mock('next/navigation', () => ({ usePathname: () => '/lectures' }))

vi.mock('@/lib/settings/use-settings', async () => {
  const { defaultSettings } = await import('@/lib/settings/schema')
  return {
    useSettings: () => ({
      settings: defaultSettings(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      updateSettings: vi.fn(),
    }),
  }
})

import SettingsProvider from './settings/SettingsProvider'

describe('MobileBottomNav', () => {
  Element.prototype.scrollIntoView = vi.fn()
  afterEach(cleanup)

  it('renders readable labels, a safe-area inset and the active tab', () => {
    render(<SettingsProvider><MobileBottomNav /></SettingsProvider>)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.className).toContain('env(safe-area-inset-bottom)')
    const active = screen.getByRole('link', { name: 'Lectures' })
    expect(active.getAttribute('aria-current')).toBe('page')
    expect(active.className).toContain('min-h-12')
    const label = active.querySelector('span')
    expect(label?.className).toContain('text-xs')
    expect(label?.className).not.toContain('text-[9px]')
  })
})
