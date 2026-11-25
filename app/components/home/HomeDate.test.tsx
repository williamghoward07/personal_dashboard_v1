import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HomeDate from './HomeDate'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('updates when the London day changes and when the page becomes visible', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-01T22:59:00Z'))
  render(<HomeDate />)
  expect(screen.getByText('Monday 1 June')).toBeTruthy()
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByText('Tuesday 2 June')).toBeTruthy()
  vi.setSystemTime(new Date('2026-06-03T12:00:00Z'))
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(screen.getByText('Wednesday 3 June')).toBeTruthy()
})
