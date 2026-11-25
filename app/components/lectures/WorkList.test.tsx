import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { WorkItem } from '@/lib/blackboard/work'
import WorkList from './WorkList'

vi.mock('@/lib/lectures/prep-writes', () => ({ saveSessionState: vi.fn() }))
vi.mock('@/lib/settings/use-settings', () => ({
  useSettings: () => ({ settings: { work_filter: { tab: 'upcoming', categories: 'all', modules: 'all' } }, updateSettings: vi.fn() }),
}))
vi.mock('./WorkRow', () => ({ default: ({ item }: { item: WorkItem }) => <li>Actions for {item.title}</li> }))
vi.mock('./ConnectedSessionPrep', () => ({ default: () => <div>Session preparation controls</div> }))

afterEach(cleanup)

const item = (key: string, title: string, status: 'suggested' | 'confirmed'): WorkItem => ({
  key, title, source: 'key_date', category: 'formative', moduleCode: 'GEOG1', courseName: 'Geography',
  dueOn: '2026-11-15', dueAt: null, done: false, doneVia: null, url: null, keyDateId: key,
  ai: { status, from: 'content', quote: `Source for ${title}`, sourceUrl: null },
})

describe('Lectures work details', () => {
  it('selects an item and keeps date confirmation separate in its details', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    render(<WorkList items={[item('one', 'First deadline', 'suggested'), item('two', 'Second deadline', 'confirmed')]} now={new Date('2026-11-13T12:00:00Z')} accent="orange" detailView />)
    const details = screen.getByRole('complementary', { name: 'Selected work details' })
    expect(within(details).getByText('Date needs confirmation')).toBeTruthy()
    expect(within(details).getByText('Actions for First deadline')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Second deadline/ }))
    expect(within(details).getByText('Date confirmed')).toBeTruthy()
    expect(within(details).getByText('Actions for Second deadline')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Second deadline/ }).getAttribute('aria-pressed')).toBe('true')
    vi.unstubAllGlobals()
  })

  it('moves focus to the updated details on mobile', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const scroll = vi.fn()
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scroll
    render(<WorkList items={[item('one', 'First deadline', 'suggested'), item('two', 'Second deadline', 'confirmed')]} now={new Date('2026-11-13T12:00:00Z')} accent="orange" detailView />)
    fireEvent.click(screen.getByRole('button', { name: /Second deadline/ }))
    const details = screen.getByRole('complementary', { name: 'Selected work details' })
    expect(document.activeElement).toBe(details)
    expect(within(details).getByText('Date confirmed')).toBeTruthy()
    expect(scroll).toHaveBeenCalled()
    HTMLElement.prototype.scrollIntoView = original
    vi.unstubAllGlobals()
  })
})
