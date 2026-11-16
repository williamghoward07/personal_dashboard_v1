import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveHomeLayout, studyHomeLayout, type HomeLayoutEntry } from '@/lib/home/layout'
import HomeGrid from './HomeGrid'

const { updateSettings } = vi.hoisted(() => ({ updateSettings: vi.fn(async () => {}) }))
const savedLayout: HomeLayoutEntry[] = [
  { id: 'calendar', span: 2, hidden: false, height: 240 },
  { id: 'due-soon', span: 1, hidden: false },
  { id: 'app-launcher', span: 1, hidden: true },
]

vi.mock('../settings/SettingsProvider', () => ({
  useAppSettings: () => ({ settings: { home_layout: savedLayout }, updateSettings }),
}))

vi.mock('./widget-registry', () => {
  const Widget = () => null
  return { homeWidgetComponent: () => Widget }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  updateSettings.mockClear()
})

it('previews and cancels Study layout without saving, then saves it on Apply', async () => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

  render(<HomeGrid heading={<h1>Home</h1>} query={null} />)
  click('Customise')
  const arrangeOrder = () => screen.getAllByRole('button', { name: /^Reorder / })
    .map((button) => button.getAttribute('aria-label'))
  expect(arrangeOrder().slice(0, 2)).toEqual(['Reorder Calendar', 'Reorder Study priorities'])

  click('Study layout')
  expect(screen.queryByRole('button', { name: /^Reorder / })).toBeNull()
  expect(updateSettings).not.toHaveBeenCalled()

  click('Cancel')
  expect(arrangeOrder().slice(0, 2)).toEqual(['Reorder Calendar', 'Reorder Study priorities'])
  expect(updateSettings).not.toHaveBeenCalled()

  click('Study layout')
  await act(async () => { click('Apply layout') })
  expect(updateSettings).toHaveBeenCalledExactlyOnceWith({
    home_layout: studyHomeLayout(resolveHomeLayout(savedLayout)),
  })
})
