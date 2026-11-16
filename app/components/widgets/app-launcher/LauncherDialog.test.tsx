import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { LauncherLink } from '@/lib/app-launcher/launcher-groups'
import LauncherDialog from './LauncherDialog'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('opens a labelled modal and closes on Escape with reduced motion', async () => {
  const show = vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', '') })
  HTMLDialogElement.prototype.showModal = show
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const onClose = vi.fn()
  render(<LauncherDialog title="A very long folder name" links={[{ id: '1', title: 'AReallyLongUnbrokenAppName', url: 'https://example.com' } as LauncherLink]} onClose={onClose} />)
  const dialog = screen.getByRole('dialog', { name: 'A very long folder name' })
  expect(show).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'AReallyLongUnbrokenAppName' })).toBeTruthy()
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  vi.unstubAllGlobals()
})
