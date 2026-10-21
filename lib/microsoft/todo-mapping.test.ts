import { describe, expect, it } from 'vitest'
import {
  appListIdFor,
  changesToGraphPatch,
  changesToStepPatch,
  mapTaskToRow,
  shouldImportTask,
  syncableLists,
  taskNotes,
  todoToTaskBody,
  type GraphTodoTask,
} from './todo-mapping'

const NOW = '2026-09-16T12:00:00.000Z'

const task = (overrides: Partial<GraphTodoTask> = {}): GraphTodoTask => ({
  id: 'task-1',
  title: 'Essay plan',
  status: 'notStarted',
  importance: 'normal',
  ...overrides,
})

describe('mapTaskToRow', () => {
  it('maps a plain open task', () => {
    expect(mapTaskToRow(task(), 'list-a', null, NOW)).toEqual({
      title: 'Essay plan',
      notes: null,
      due_date: null,
      due_time: null,
      completed_at: null,
      starred: false,
      list_id: null,
      mstodo_task_id: 'task-1',
      mstodo_list_id: 'list-a',
      steps: null,
    })
  })

  it('maps checklist items to steps when they were fetched', () => {
    const row = mapTaskToRow(
      task({
        checklistItems: [
          { id: 's1', displayName: ' Read ch.2 ', isChecked: true, checkedDateTime: '2026-09-15T10:00:00Z' },
          { id: 's2', displayName: 'Notes', isChecked: false },
        ],
      }),
      'l',
      null,
      NOW
    )
    expect(row.steps).toEqual([
      { title: 'Read ch.2', completed_at: '2026-09-15T10:00:00Z', mstodo_checklist_item_id: 's1' },
      { title: 'Notes', completed_at: null, mstodo_checklist_item_id: 's2' },
    ])
  })

  it('stars important tasks', () => {
    expect(mapTaskToRow(task({ importance: 'high' }), 'l', null, NOW).starred).toBe(true)
  })

  it('takes the due date as-is when given in London time', () => {
    const row = mapTaskToRow(
      task({ dueDateTime: { dateTime: '2026-09-18T00:00:00.0000000', timeZone: 'Europe/London' } }),
      'l',
      null,
      NOW
    )
    expect(row.due_date).toBe('2026-09-18')
    expect(row.due_time).toBeNull()
  })

  it('uses the reminder for the time (UTC converted to London, BST)', () => {
    const row = mapTaskToRow(
      task({
        dueDateTime: { dateTime: '2026-09-18T00:00:00.0000000', timeZone: 'Europe/London' },
        isReminderOn: true,
        reminderDateTime: { dateTime: '2026-09-18T16:00:00.0000000', timeZone: 'UTC' },
      }),
      'l',
      null,
      NOW
    )
    expect(row.due_date).toBe('2026-09-18')
    expect(row.due_time).toBe('17:00')
  })

  it('uses the reminder date when there is no due date', () => {
    const row = mapTaskToRow(
      task({
        isReminderOn: true,
        reminderDateTime: { dateTime: '2026-09-20T08:30:00.0000000', timeZone: 'Europe/London' },
      }),
      'l',
      null,
      NOW
    )
    expect(row.due_date).toBe('2026-09-20')
    expect(row.due_time).toBe('08:30')
  })

  it('ignores a reminder on a different day from the due date, and a switched-off reminder', () => {
    const differentDay = mapTaskToRow(
      task({
        dueDateTime: { dateTime: '2026-09-18T00:00:00.0000000', timeZone: 'Europe/London' },
        isReminderOn: true,
        reminderDateTime: { dateTime: '2026-09-17T09:00:00.0000000', timeZone: 'Europe/London' },
      }),
      'l',
      null,
      NOW
    )
    expect(differentDay.due_time).toBeNull()

    const off = mapTaskToRow(
      task({
        isReminderOn: false,
        reminderDateTime: { dateTime: '2026-09-17T09:00:00.0000000', timeZone: 'Europe/London' },
      }),
      'l',
      null,
      NOW
    )
    expect(off.due_date).toBeNull()
  })

  it('maps completion with its timestamp, falling back to now', () => {
    const done = mapTaskToRow(
      task({ status: 'completed', completedDateTime: { dateTime: '2026-09-15T10:00:00.0000000', timeZone: 'UTC' } }),
      'l',
      null,
      NOW
    )
    expect(done.completed_at).toBe('2026-09-15T10:00:00Z')
    expect(mapTaskToRow(task({ status: 'completed' }), 'l', null, NOW).completed_at).toBe(NOW)
  })

  it('keeps the app list id and falls back to Untitled', () => {
    const row = mapTaskToRow(task({ title: '  ' }), 'l', 'app-list', NOW)
    expect(row.title).toBe('Untitled')
    expect(row.list_id).toBe('app-list')
  })
})

describe('taskNotes', () => {
  it('reads text bodies and strips html ones', () => {
    expect(taskNotes(task({ body: { content: '  bring laptop ', contentType: 'text' } }))).toBe('bring laptop')
    expect(taskNotes(task({ body: { content: '<p>Line&nbsp;one</p><p>two</p>', contentType: 'html' } }))).toBe(
      'Line one\ntwo'
    )
    expect(taskNotes(task({ body: { content: '', contentType: 'text' } }))).toBeNull()
  })
})

describe('shouldImportTask', () => {
  it('imports open tasks and anything already linked', () => {
    expect(shouldImportTask(task(), false, NOW)).toBe(true)
    expect(shouldImportTask(task({ status: 'completed' }), true, NOW)).toBe(true)
  })

  it('imports recently completed tasks only', () => {
    const recent = task({
      status: 'completed',
      completedDateTime: { dateTime: '2026-09-01T00:00:00.0000000', timeZone: 'UTC' },
    })
    const old = task({
      status: 'completed',
      completedDateTime: { dateTime: '2026-06-01T00:00:00.0000000', timeZone: 'UTC' },
    })
    expect(shouldImportTask(recent, false, NOW)).toBe(true)
    expect(shouldImportTask(old, false, NOW)).toBe(false)
    expect(shouldImportTask(task({ status: 'completed' }), false, NOW)).toBe(false)
  })
})

describe('changesToGraphPatch', () => {
  it('maps each supported change', () => {
    expect(changesToGraphPatch({ completed: true, starred: false })).toEqual({
      status: 'completed',
      importance: 'normal',
    })
    expect(changesToGraphPatch({ completed: false, starred: true })).toEqual({
      status: 'notStarted',
      importance: 'high',
    })
    expect(changesToGraphPatch({ title: 'New', notes: null, due_date: '2026-09-20' })).toEqual({
      title: 'New',
      body: { content: '', contentType: 'text' },
      dueDateTime: { dateTime: '2026-09-20T00:00:00', timeZone: 'Europe/London' },
      isReminderOn: false,
    })
    expect(changesToGraphPatch({ due_date: null })).toEqual({ dueDateTime: null, isReminderOn: false })
    expect(changesToGraphPatch({})).toEqual({})
  })

  it('sends the time as a reminder on the due date', () => {
    expect(changesToGraphPatch({ due_date: '2026-10-10', due_time: '14:30' })).toEqual({
      dueDateTime: { dateTime: '2026-10-10T00:00:00', timeZone: 'Europe/London' },
      isReminderOn: true,
      reminderDateTime: { dateTime: '2026-10-10T14:30:00', timeZone: 'Europe/London' },
    })
  })

  it('round-trips a reminder through mapTaskToRow', () => {
    const body = todoToTaskBody({
      title: 'Seminar prep',
      notes: null,
      due_date: '2026-10-10',
      due_time: '09:15',
      completed_at: null,
      starred: true,
    })
    const row = mapTaskToRow({ id: 't', status: 'notStarted', ...body } as GraphTodoTask, 'l', null, NOW)
    expect(row).toMatchObject({ title: 'Seminar prep', due_date: '2026-10-10', due_time: '09:15', starred: true })
  })
})

describe('changesToStepPatch', () => {
  it('maps ticks and renames only', () => {
    expect(changesToStepPatch({ completed: true, title: 'x', due_date: '2026-01-01' })).toEqual({
      isChecked: true,
      displayName: 'x',
    })
  })
})

describe('lists', () => {
  const lists = [
    { id: 'd', displayName: 'Tasks', wellknownListName: 'defaultList' },
    { id: 'f', displayName: 'Flagged email', wellknownListName: 'flaggedEmails' },
    { id: 'u', displayName: 'Uni', wellknownListName: 'none' },
  ]

  it('skips the flagged-email list', () => {
    expect(syncableLists(lists).map((l) => l.id)).toEqual(['d', 'u'])
  })

  it('maps the default list to no list and others by name', () => {
    const appLists = [{ id: 'app-uni', name: 'uni ' }]
    expect(appListIdFor(lists[0], appLists)).toBeNull()
    expect(appListIdFor(lists[2], appLists)).toBe('app-uni')
    expect(appListIdFor({ id: 'x', displayName: 'Other' }, appLists)).toBeNull()
  })
})
