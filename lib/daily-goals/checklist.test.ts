import { describe, expect, it } from 'vitest'
import { selectChecklistTodos } from './checklist'
import type { Todo } from '@/lib/types'

const TODAY = '2026-08-05'

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: `todo-${Math.random()}`,
    title: 'Untitled',
    notes: null,
    due_date: null,
    due_time: null,
    completed_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    caldav_uid: null,
    list_id: null,
    parent_id: null,
    notes_document_id: null,
    ...overrides,
  }
}

describe('selectChecklistTodos', () => {
  it('includes todos due today regardless of completion state', () => {
    const dueTodayDone = todo({ id: 'a', due_date: TODAY, completed_at: '2026-08-05T09:00:00.000Z' })
    const dueTodayNotDone = todo({ id: 'b', due_date: TODAY })

    const result = selectChecklistTodos([dueTodayDone, dueTodayNotDone], TODAY)

    expect(result.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('surfaces overdue incomplete todos, flagged as overdue', () => {
    const overdue = todo({ id: 'c', due_date: '2026-08-01', completed_at: null })
    const result = selectChecklistTodos([overdue], TODAY)

    expect(result).toHaveLength(1)
    expect(result[0].overdue).toBe(true)
  })

  it('excludes overdue todos that are already completed', () => {
    const overdueDone = todo({ id: 'd', due_date: '2026-08-01', completed_at: '2026-08-01T09:00:00.000Z' })
    expect(selectChecklistTodos([overdueDone], TODAY)).toHaveLength(0)
  })

  it('excludes future-dated todos and undated todos', () => {
    const future = todo({ id: 'e', due_date: '2026-08-10' })
    const undated = todo({ id: 'f', due_date: null })
    expect(selectChecklistTodos([future, undated], TODAY)).toHaveLength(0)
  })

  it('sorts overdue items before today\'s items', () => {
    const dueToday = todo({ id: 'g', due_date: TODAY })
    const overdue = todo({ id: 'h', due_date: '2026-08-01' })

    const result = selectChecklistTodos([dueToday, overdue], TODAY)

    expect(result.map((t) => t.id)).toEqual(['h', 'g'])
  })
})
