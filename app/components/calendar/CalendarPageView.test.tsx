import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { londonDayBoundsUTC } from '@/lib/google/london-day'
import CalendarPageView from './CalendarPageView'
import { formatDayHeading } from './calendarItems'

const todayKey = londonDayBoundsUTC().startDateKey
const dateLabel = formatDayHeading(todayKey)
const task = { id: 'task-1', title: 'Read the fieldwork notes', due_date: todayKey }

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        gte: () => ({
          lt: async () => ({ data: table === 'tasks' ? [task] : [] }),
        }),
      }),
    }),
  },
}))
vi.mock('@/lib/settings/use-settings', () => ({
  useSettings: () => ({ settings: { calendar_view: 'month' }, updateSettings: vi.fn() }),
}))
vi.mock('@/lib/lectures/use-timetable', () => ({
  useTimetable: () => ({ sessions: [], tracked: new Map() }),
}))
vi.mock('@/lib/blackboard/use-work-items', () => ({
  useWorkItems: () => ({ items: [] }),
}))
vi.mock('./routines/RoutinesPanel', () => ({
  default: () => <h2>Routine scheduler</h2>,
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 409 })))
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(Element.prototype, 'scrollTo')
  vi.unstubAllGlobals()
})

describe('Calendar views when Google Calendar is disconnected', () => {
  it('keeps date details, local tasks, grid controls, agenda, and routines available', async () => {
    render(<CalendarPageView />)

    expect(await screen.findByText('Google Calendar is disconnected.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reconnect Google Calendar' })).toBeTruthy()
    const details = screen.getByRole('complementary', { name: dateLabel })
    expect(within(details).getByRole('button', { name: task.title })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    expect(screen.getByRole('button', { name: 'Fit day' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fit day' }))
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }))
    expect(await screen.findByRole('button', { name: task.title })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    const tasks = screen.getByRole('complementary', { name: 'Tasks and deadlines' })
    expect(await within(tasks).findByRole('button', { name: task.title })).toBeTruthy()
    expect(within(tasks).getByRole('button', { name: 'Auto time-block today' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Routines' }))
    expect(screen.getByRole('heading', { name: 'Routine scheduler' })).toBeTruthy()
  })

  it('opens the selected date in a dialog on a narrow viewport', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    render(<CalendarPageView />)

    fireEvent.click(screen.getByRole('button', { name: dateLabel }))
    const dialog = screen.getByRole('dialog', { name: dateLabel })
    expect(await within(dialog).findByRole('button', { name: task.title })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
