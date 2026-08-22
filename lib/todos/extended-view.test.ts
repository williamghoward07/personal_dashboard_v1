import { describe, expect, it } from 'vitest'
import { groupTodosForExtendedView } from './extended-view'
import type { Todo } from '@/lib/types'

// 2026-08-05 is a Wednesday, so tomorrow is 08-06 and the current ISO
// week (Monday-start) ends Sunday 08-09.
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
    ...overrides,
  }
}

describe('groupTodosForExtendedView', () => {
  it('buckets an overdue todo', () => {
    const t = todo({ id: 'a', due_date: '2026-08-01' })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.overdue.map((x) => x.id)).toEqual(['a'])
  })

  it('buckets a todo due today', () => {
    const t = todo({ id: 'a', due_date: TODAY })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.today.map((x) => x.id)).toEqual(['a'])
  })

  it('buckets a todo due tomorrow', () => {
    const t = todo({ id: 'a', due_date: '2026-08-06' })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.tomorrow.map((x) => x.id)).toEqual(['a'])
  })

  it('buckets a todo later this week (after tomorrow, through Sunday)', () => {
    const t = todo({ id: 'a', due_date: '2026-08-09' })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.thisWeek.map((x) => x.id)).toEqual(['a'])
  })

  it('buckets a todo due after this week as later', () => {
    const t = todo({ id: 'a', due_date: '2026-08-10' })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.later.map((x) => x.id)).toEqual(['a'])
  })

  it('buckets an undated todo as no date', () => {
    const t = todo({ id: 'a', due_date: null })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.noDate.map((x) => x.id)).toEqual(['a'])
  })

  it('sorts each date bucket by due date then created_at', () => {
    const later1 = todo({ id: 'a', due_date: '2026-08-20', created_at: '2026-08-01T00:00:00.000Z' })
    const later2 = todo({ id: 'b', due_date: '2026-08-15', created_at: '2026-08-01T00:00:00.000Z' })
    const groups = groupTodosForExtendedView([later1, later2], TODAY)
    expect(groups.later.map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('includes a completed todo in its date bucket regardless of completion state', () => {
    const t = todo({ id: 'a', due_date: TODAY, completed_at: '2026-08-05T09:00:00.000Z' })
    const groups = groupTodosForExtendedView([t], TODAY)
    expect(groups.today.map((x) => x.id)).toEqual(['a'])
  })
})
