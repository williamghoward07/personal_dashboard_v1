import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { launcherHeightForRows } from '@/lib/app-launcher/launcher-layout'
import AppLauncherGlance from './AppLauncherGlance'

const { links } = vi.hoisted(() => ({
  links: Array.from({ length: 32 }, (_, i) => ({
    id: String(i + 1),
    title: `App ${i + 1}`,
    url: `https://app${i + 1}.example.com`,
  })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: async () => ({ data: links }) }) }) },
}))
vi.mock('../../settings/SettingsProvider', () => ({
  useAppSettings: () => ({
    settings: { launcher_link_ids: links.map((link) => link.id).reverse() },
    loading: false,
    updateSettings: vi.fn(),
  }),
}))
vi.mock('./LauncherMenu', () => ({ default: () => null }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('shows more selected apps in order as width or row capacity grows', async () => {
  let onMeasure: ((entries: { contentRect: { width: number } }[]) => void) | undefined
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: typeof onMeasure) { onMeasure = callback }
    observe() {}
    disconnect() {}
  })

  const { container, rerender } = render(<AppLauncherGlance />)
  const tiles = () => within(container).queryAllByRole('button')
  const measure = (width: number) => act(() => onMeasure?.([{ contentRect: { width } }]))
  measure(240)
  await waitFor(() => expect(tiles()).toHaveLength(8))
  expect(tiles()[0].title).toBe('App 32')

  rerender(<AppLauncherGlance height={launcherHeightForRows(3)} />)
  expect(tiles()).toHaveLength(12)
  expect(tiles()[8].title).toBe('App 24')

  rerender(<AppLauncherGlance height={launcherHeightForRows(4)} />)
  expect(tiles()).toHaveLength(16)

  rerender(<AppLauncherGlance span={2} />)
  measure(480)
  expect(tiles()).toHaveLength(16)
  measure(150)
  expect(tiles()).toHaveLength(6)
})
