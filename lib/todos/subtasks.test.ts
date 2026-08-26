import { describe, expect, it } from 'vitest'
import { groupByParent } from './subtasks'
import type { Todo } from '@/lib/types'

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

describe('groupByParent', () => {
  it('puts todos with no parent_id in topLevel', () => {
    const t = todo({ id: 'a' })
    const { topLevel, childrenByParent } = groupByParent([t])
    expect(topLevel.map((x) => x.id)).toEqual(['a'])
    expect(childrenByParent).toEqual({})
  })

  it('groups children under their parent_id, excluded from topLevel', () => {
    const parent = todo({ id: 'p' })
    const child1 = todo({ id: 'c1', parent_id: 'p' })
    const child2 = todo({ id: 'c2', parent_id: 'p' })

    const { topLevel, childrenByParent } = groupByParent([parent, child1, child2])

    expect(topLevel.map((x) => x.id)).toEqual(['p'])
    expect(childrenByParent['p'].map((x) => x.id)).toEqual(['c1', 'c2'])
  })

  it('handles multiple parents independently', () => {
    const parentA = todo({ id: 'pa' })
    const parentB = todo({ id: 'pb' })
    const childA = todo({ id: 'ca', parent_id: 'pa' })
    const childB = todo({ id: 'cb', parent_id: 'pb' })

    const { topLevel, childrenByParent } = groupByParent([parentA, parentB, childA, childB])

    expect(topLevel.map((x) => x.id).sort()).toEqual(['pa', 'pb'])
    expect(childrenByParent['pa'].map((x) => x.id)).toEqual(['ca'])
    expect(childrenByParent['pb'].map((x) => x.id)).toEqual(['cb'])
  })
})
