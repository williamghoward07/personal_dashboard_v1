import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LauncherLink } from '@/lib/app-launcher/launcher-groups'
import LauncherDialog from './LauncherDialog'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const links = [{ id: '1', title: 'AReallyLongUnbrokenAppName', url: 'https://example.com' } as LauncherLink]
const rect = { left: 10, top: 10, width: 64, height: 64, right: 74, bottom: 74, x: 10, y: 10 } as DOMRect

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete (HTMLElement.prototype as { animate?: unknown }).animate
})

it('opens a labelled modal and closes on Escape with reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const onClose = vi.fn()
  render(<LauncherDialog title="A very long folder name" links={links} onClose={onClose} />)
  const dialog = screen.getByRole('dialog', { name: 'A very long folder name' })
  expect(screen.getByRole('button', { name: 'AReallyLongUnbrokenAppName' })).toBeTruthy()
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(dialog.hasAttribute('open')).toBe(false)
})

it('returns focus to the tapped tile and animates without transforms under reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const animate = vi.fn(() => ({ onfinish: null as null | (() => void) }) as unknown as Animation)
  HTMLElement.prototype.animate = animate
  const trigger = document.createElement('button')
  document.body.appendChild(trigger)
  const onClose = vi.fn()
  render(<LauncherDialog title="F" links={links} onClose={onClose} origin={rect} returnFocusTo={trigger} />)
  const frames = animate.mock.calls.flatMap((call) => (call as unknown as [Keyframe[]])[0])
  expect(frames.some((frame) => 'transform' in frame)).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})

it('shrinks back into the tile and never sticks open if the animation never finishes', () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const animate = vi.fn(() => ({ onfinish: null }) as unknown as Animation)
  HTMLElement.prototype.animate = animate
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...rect, left: 200, top: 200, width: 400, height: 300 })
  const onClose = vi.fn()
  const onClosing = vi.fn()
  render(<LauncherDialog title="F" links={links} onClose={onClose} onClosing={onClosing} origin={rect} />)
  const opening = animate.mock.calls.flatMap((call) => (call as unknown as [Keyframe[]])[0])
  expect(opening.some((frame) => String(frame.transform).includes('scale'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClosing).toHaveBeenCalledOnce()
  expect(onClose).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(500) })
  expect(onClose).toHaveBeenCalledOnce()
})
