import { describe, expect, it } from 'vitest'
import { capChecklist, selectChecklistTodos } from './checklist'
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
    mstodo_task_id: null,
    mstodo_list_id: null,
    mstodo_checklist_item_id: null,
    starred: false,
    list_id: null,
    parent_id: null,
    notes_document_id: null,
    workspace_id: null,
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

  it('leaves starred undated todos out unless asked for', () => {
    const starred = todo({ id: 'i', starred: true })
    expect(selectChecklistTodos([starred], TODAY)).toHaveLength(0)
    expect(selectChecklistTodos([starred], TODAY, { includeStarred: true }).map((t) => t.id)).toEqual(['i'])
  })

  it('keeps a starred undated todo on the day it was ticked, not after', () => {
    // 23:30 UTC on the 4th is 00:30 on the 5th in London (BST).
    const tickedToday = todo({ id: 'j', starred: true, completed_at: '2026-08-04T23:30:00.000Z' })
    const tickedYesterday = todo({ id: 'k', starred: true, completed_at: '2026-08-04T12:00:00.000Z' })
    const result = selectChecklistTodos([tickedToday, tickedYesterday], TODAY, { includeStarred: true })
    expect(result.map((t) => t.id)).toEqual(['j'])
  })

  it('keeps an unstarred undated todo that was touched this visit', () => {
    const unstarred = todo({ id: 'q', starred: false })
    const result = selectChecklistTodos([unstarred], TODAY, { includeStarred: true, keepIds: new Set(['q']) })
    expect(result.map((t) => t.id)).toEqual(['q'])
  })

  it('does not pull in starred future-dated todos', () => {
    const future = todo({ id: 'l', starred: true, due_date: '2026-08-10' })
    expect(selectChecklistTodos([future], TODAY, { includeStarred: true })).toHaveLength(0)
  })

  it('orders starred, then overdue, then today', () => {
    const dueToday = todo({ id: 'm', due_date: TODAY })
    const overdue = todo({ id: 'n', due_date: '2026-08-01' })
    const starredUndated = todo({ id: 'o', starred: true })
    const starredToday = todo({ id: 'p', starred: true, due_date: TODAY })

    const result = selectChecklistTodos([dueToday, overdue, starredUndated, starredToday], TODAY, {
      includeStarred: true,
    })

    expect(result.map((t) => t.id)).toEqual(['o', 'p', 'n', 'm'])
  })
})

describe('capChecklist', () => {
  const open = (id: string) => ({ id, completed_at: null })
  const done = (id: string) => ({ id, completed_at: '2026-08-05T09:00:00.000Z' })
  const none = new Set<string>()

  it('shows at most five incomplete rows and counts the rest', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(open)
    const result = capChecklist(items, none)
    expect(result.rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result.hiddenCount).toBe(2)
    expect(result.doneCount).toBe(0)
  })

  it('folds completed rows into a count', () => {
    const result = capChecklist([done('a'), open('b'), done('c')], none)
    expect(result.rows.map((r) => r.id)).toEqual(['b'])
    expect(result.doneCount).toBe(2)
    expect(result.hiddenCount).toBe(0)
  })

  it('keeps rows ticked this visit in place without using a slot', () => {
    const items = [open('a'), done('b'), open('c'), open('d'), open('e'), open('f'), open('g')]
    const result = capChecklist(items, new Set(['b']))
    expect(result.rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result.hiddenCount).toBe(1)
    expect(result.doneCount).toBe(0)
  })

  it('always shows a kept incomplete row, even past the cap', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'new'].map(open)
    const result = capChecklist(items, new Set(['new']))
    expect(result.rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'new'])
    expect(result.hiddenCount).toBe(0)
  })

  it('respects a custom cap', () => {
    const result = capChecklist(['a', 'b', 'c'].map(open), none, 1)
    expect(result.rows.map((r) => r.id)).toEqual(['a'])
    expect(result.hiddenCount).toBe(2)
  })
})
