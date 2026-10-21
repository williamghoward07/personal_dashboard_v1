import { describe, expect, it } from 'vitest'
import type { Todo } from '@/lib/types'
import { changedFields, isSyncedTodo, syncedChanges } from './patch'

const todo = (overrides: Partial<Todo> = {}): Todo => ({
  id: 't',
  title: 'Read chapter 4',
  notes: null,
  due_date: '2026-10-10',
  due_time: null,
  completed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  caldav_uid: null,
  mstodo_task_id: null,
  mstodo_list_id: null,
  mstodo_checklist_item_id: null,
  starred: false,
  list_id: null,
  parent_id: null,
  notes_document_id: null,
  workspace_id: null,
  ...overrides,
})

describe('syncedChanges', () => {
  it('keeps the To Do fields and drops app-only ones', () => {
    expect(syncedChanges({ title: 'x', due_time: '09:00', workspace_id: 'w', parent_id: null })).toEqual({
      title: 'x',
      due_time: '09:00',
    })
  })
})

describe('changedFields', () => {
  it('returns only real changes', () => {
    expect(changedFields(todo(), { title: 'Read chapter 4', due_time: '14:00' })).toEqual({ due_time: '14:00' })
  })
})

describe('isSyncedTodo', () => {
  it('uses the task id for top-level todos and the step id for subtasks', () => {
    expect(isSyncedTodo(todo({ mstodo_task_id: 'a' }))).toBe(true)
    expect(isSyncedTodo(todo({ parent_id: 'p', mstodo_task_id: null }))).toBe(false)
    expect(isSyncedTodo(todo({ parent_id: 'p', mstodo_checklist_item_id: 's' }))).toBe(true)
  })
})
