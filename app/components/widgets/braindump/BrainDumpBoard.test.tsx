import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brainDumpStore as store } from '@/lib/braindump/store'
import type { BrainDumpDraft, BrainDumpDraftKind } from '@/lib/braindump/types'
import BrainDumpBoard from './BrainDumpBoard'

const { insert, update } = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: async () => ({
          data: table === 'people' ? [{ id: 'alex', full_name: 'Alex Morgan' }] : [],
        }),
      }),
      insert: (values: unknown) => insert(table, values),
      update: (values: unknown) => ({ eq: (column: string, id: string) => update(table, values, column, id) }),
    }),
  },
}))

function draft(kind: BrainDumpDraftKind, fields: Partial<BrainDumpDraft>): BrainDumpDraft {
  return { kind, act: null, person: null, person_match: null, interaction: null, ...fields }
}

const task = (title: string) => draft('todo', { act: { title, due_date: null, due_time: null, notes: null } })
const event = draft('calendar_event', {
  act: { title: 'Fieldwork briefing', due_date: null, due_time: '13:00', notes: null },
})
const contact = draft('new_person', {
  person: {
    full_name: 'Sam Patel',
    email: null,
    phone: null,
    company: null,
    job_title: null,
    how_we_met: null,
    notes: null,
    tags: null,
  },
})
const interaction = draft('log_interaction', {
  person_match: { id: 'alex', confidence: 1 },
  interaction: {
    summary: 'Spoke about the group presentation',
    occurred_at: '2026-11-15T09:30:00Z',
    channel: 'in_person',
    follow_up: null,
  },
})

const fetchMock = vi.fn()
const original = '  Read the paper tomorrow. Ask Alex about the presentation.\n'
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function startCapture(drafts: BrainDumpDraft[]) {
  fetchMock.mockResolvedValueOnce(response({ drafts }))
  render(<BrainDumpBoard />)
  const box = screen.getByRole('textbox', { name: 'Capture text' }) as HTMLTextAreaElement
  fireEvent.change(box, { target: { value: original } })
  fireEvent.click(screen.getByRole('button', { name: 'Extract items' }))
  return box
}

function row(title: string) {
  return within(screen.getByRole('heading', { name: title }).closest('li')!)
}

beforeEach(() => {
  fetchMock.mockReset()
  insert.mockReset()
  update.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  store.getSnapshot().drafts.forEach(({ clientId }) => store.setDraftStatus(clientId, 'rejected'))
  store.clearFinished()
  store.setText('')
  vi.unstubAllGlobals()
})

describe('Brain dump', () => {
  it('opens review after extracting and preserves the exact capture when going back', async () => {
    const box = startCapture([task('Read the paper')])
    await screen.findByRole('heading', { name: 'Read the paper' })
    const steps = within(screen.getByRole('navigation', { name: 'Brain dump steps' }))
    expect(steps.getByRole('button', { name: 'Review' }).getAttribute('aria-current')).toBe('step')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/brain-dump/extract'])
    expect(insert).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Back to capture' }))
    expect(steps.getByRole('button', { name: 'Capture' }).getAttribute('aria-current')).toBe('step')
    expect(box.value).toBe(original)
    expect((screen.getByRole('button', { name: 'Extract items' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('cancels extraction and keeps the capture available to retry', async () => {
    fetchMock.mockImplementationOnce((_url, request: RequestInit) => new Promise((_resolve, reject) => {
      request.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
    }))
    render(<BrainDumpBoard />)
    const box = screen.getByRole('textbox', { name: 'Capture text' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: original } })
    fireEvent.click(screen.getByRole('button', { name: 'Extract items' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await screen.findByRole('button', { name: 'Extract items' })
    expect(box.value).toBe(original)
    expect(store.getSnapshot().drafts).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('bulk confirms only ready items and keeps failed drafts available to retry', async () => {
    startCapture([task('Read the paper'), task('Prepare notes'), event, contact])
    await screen.findByRole('heading', { name: 'Read the paper' })
    expect(screen.getByText('2 ready')).toBeTruthy()
    expect(screen.getByText('2 need review')).toBeTruthy()
    expect((row('Fieldwork briefing').getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true)

    let finishFirst!: (value: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve }))
    fetchMock.mockResolvedValueOnce(response({ message: 'Task service unavailable.' }, 500))
    const bulk = screen.getByRole('button', { name: 'Confirm 2 ready items' })
    const one = row('Read the paper').getByRole('button', { name: 'Confirm' })
    act(() => {
      fireEvent.click(bulk)
      fireEvent.click(bulk)
      fireEvent.click(one)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    finishFirst(response({ success: true }))
    expect((await screen.findByRole('alert')).textContent).toContain('Task service unavailable.')
    const saves = fetchMock.mock.calls.slice(1).map(([url, init]) => ({
      url,
      title: JSON.parse(init.body).draft.title,
    }))
    expect(saves).toEqual([
      { url: '/api/capture/confirm', title: 'Read the paper' },
      { url: '/api/capture/confirm', title: 'Prepare notes' },
    ])
    expect(row('Read the paper').getByText('Added')).toBeTruthy()
    expect(row('Prepare notes').getByRole('button', { name: 'Confirm' })).toBeTruthy()
    expect(row('Sam Patel').getByRole('button', { name: 'Review' })).toBeTruthy()
    expect(insert).not.toHaveBeenCalled()

    fireEvent.click(row('Fieldwork briefing').getByRole('button', { name: 'Edit' }))
    fireEvent.change(row('Fieldwork briefing').getByLabelText('Date'), { target: { value: '2026-11-17' } })
    expect((row('Fieldwork briefing').getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps person edits in the dialog after a failed save and guards duplicate submissions', async () => {
    startCapture([contact])
    await screen.findByRole('heading', { name: 'Sam Patel' })
    const open = row('Sam Patel').getByRole('button', { name: 'Review' })
    fireEvent.click(open)
    const dialog = screen.getByRole('dialog', { name: 'New person' })
    const name = within(dialog).getByLabelText('Full name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Samuel Patel' } })

    let complete!: (result: { error: { message: string } }) => void
    insert.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
    act(() => {
      fireEvent.submit(dialog)
      fireEvent.submit(dialog)
    })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith('people', expect.objectContaining({ full_name: 'Samuel Patel' }))
    complete({ error: { message: 'Permission denied.' } })

    const error = await within(dialog).findByRole('alert')
    expect(error.textContent).toContain('Permission denied.')
    expect(name.value).toBe('Samuel Patel')
    expect(store.getSnapshot().drafts[0].status).toBe('pending')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(document.activeElement).toBe(open)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the conversation form with matched attendees and dismisses without writing', async () => {
    startCapture([interaction])
    await screen.findByRole('heading', { name: 'Spoke about the group presentation' })
    fireEvent.click(row('Spoke about the group presentation').getByRole('button', { name: 'Review' }))
    const dialog = screen.getByRole('dialog', { name: 'Log a conversation' })
    const attendee = await within(dialog).findByRole('button', { name: 'Alex Morgan' })
    expect(attendee.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(row('Spoke about the group presentation').getByRole('button', { name: 'Dismiss' }))
    expect(row('Spoke about the group presentation').getByText('Dismissed')).toBeTruthy()
    expect(insert).not.toHaveBeenCalled()
  })
})
