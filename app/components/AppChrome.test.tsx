import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppChrome from './AppChrome'

const { getPathname, push, refresh, signOut, toggleFullscreen, updateSettings } = vi.hoisted(() => ({
  getPathname: vi.fn(() => '/'),
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  toggleFullscreen: vi.fn(),
  updateSettings: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: getPathname,
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@/lib/settings/use-settings', async () => {
  const { defaultSettings } = await import('@/lib/settings/schema')
  return {
    useSettings: () => ({
      settings: defaultSettings(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      updateSettings,
    }),
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { email: 'ada@example.test', user_metadata: { full_name: 'Ada Lovelace' } } } },
      }),
      signOut,
    },
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: async () => ({
        data: [
          { provider: 'google', last_error: null, last_synced_at: null },
          { provider: 'microsoft_onenote', last_error: 'Credentials expired', last_synced_at: null },
        ],
        error: null,
      }),
    }),
  },
}))

vi.mock('@/lib/use-fullscreen', () => ({
  useFullscreen: () => ({ isFullscreen: false, isSupported: true, toggle: toggleFullscreen }),
}))

vi.mock('./MobileBottomNav', () => ({
  default: () => <nav aria-label="Mobile" />,
}))

async function renderRoute(pathname: string) {
  getPathname.mockReturnValue(pathname)
  await act(async () => {
    render(<AppChrome><main>Page content</main></AppChrome>)
  })
}

describe('AppChrome', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it.each(['/', '/lectures', '/lectures/session', '/calendar'])('uses the workspace shell for %s', async (path) => {
    await renderRoute(path)
    expect(screen.getByRole('main').closest('.workspace-ui')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Account' }).textContent).toBe('A')
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
  })

  it('keeps the regular chrome on other routes and omits it on login', async () => {
    await renderRoute('/people')
    expect(screen.getByRole('main').closest('.workspace-ui')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('People')
    cleanup()

    await renderRoute('/login')
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('retains active navigation, capture, and the navigation settings on workspace pages', async () => {
    await renderRoute('/lectures/session')
    const rail = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(rail.getByRole('link', { name: 'Lectures', current: 'page' }).getAttribute('href')).toBe('/lectures')
    expect(rail.getByRole('link', { name: 'Quick capture' }).getAttribute('href')).toBe('/brain-dump')
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Quick capture' }).getAttribute('href')).toBe('/brain-dump')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const settings = within(screen.getByRole('dialog', { name: 'Settings' }))
    fireEvent.click(settings.getByRole('switch', { name: 'Lectures tab', checked: true }))
    expect(updateSettings).toHaveBeenCalledWith({ hidden_nav_items: ['/lectures'] })
  })

  it('shows identity, integration status, fullscreen, and sign out in the account popover', async () => {
    await renderRoute('/calendar')
    const trigger = screen.getByRole('button', { name: 'Account' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Account' })
    const account = within(dialog)
    expect(account.getByText('Ada Lovelace')).toBeTruthy()
    expect(account.getByText('ada@example.test')).toBeTruthy()
    expect(account.getByText('Connected')).toBeTruthy()
    expect(account.getByText('Credentials expired')).toBeTruthy()
    fireEvent.click(account.getByRole('button', { name: 'Enter full screen' }))
    expect(toggleFullscreen).toHaveBeenCalledOnce()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Account' })).toBeNull()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
    expect(signOut).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
  })
})
