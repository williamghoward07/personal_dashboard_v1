import { describe, expect, it } from 'vitest'
import type { Task } from '@/lib/types'
import type { WorkItem } from '@/lib/blackboard/work'
import { groupItemsByDate, isCalendarDeadline, type CalendarEvent } from './calendarItems'

function work(over: Partial<WorkItem>): WorkItem {
  return {
    key: 'bba:1',
    source: 'assignment',
    category: 'summative',
    moduleCode: 'GEOG101',
    courseName: null,
    title: 'Essay',
    dueOn: '2026-11-16',
    dueAt: null,
    done: false,
    doneVia: null,
    ai: null,
    url: null,
    ...over,
  }
}

const base = { events: [] as CalendarEvent[], tasks: [] as Task[], sessions: [], routineInstances: [] }

describe('groupItemsByDate deadlines', () => {
  it('buckets a deadline on its London day', () => {
    // 23:30 UTC on 16 Nov is 23:30 in London (GMT); a BST case: 23:30 UTC 15 Jul is 00:30 on the 16th.
    const map = groupItemsByDate({ ...base, deadlines: [work({ dueOn: '2026-07-16', dueAt: '2026-07-15T23:30:00Z' })] })
    const items = map.get('2026-07-16')
    expect(items).toHaveLength(1)
    expect(items?.[0]).toMatchObject({ kind: 'deadline', id: 'bba:1', title: 'Essay' })
    expect(map.has('2026-07-15')).toBe(false)
  })

  it('carries done through on the work item', () => {
    const map = groupItemsByDate({ ...base, deadlines: [work({ done: true })] })
    const item = map.get('2026-11-16')?.[0]
    expect(item?.kind === 'deadline' && item.item.done).toBe(true)
  })

  it('shows only standalone deadlines with a day', () => {
    const map = groupItemsByDate({
      ...base,
      deadlines: [
        work({ key: 'kd:1', source: 'key_date' }),
        work({ key: 'prep:1', source: 'prep' }),
        work({ key: 'test:1', source: 'session', category: 'test' }),
        work({ key: 'bba:2', dueOn: null }),
      ],
    })
    expect([...map.values()].flat().map((i) => i.id)).toEqual(['kd:1'])
    expect(isCalendarDeadline(work({ source: 'prep' }))).toBe(false)
  })

  it('leaves existing kinds alone and adds nothing without deadlines', () => {
    const task = { id: 't1', title: 'Read', due_date: '2026-11-16' } as Task
    const map = groupItemsByDate({ ...base, tasks: [task] })
    expect(map.get('2026-11-16')).toEqual([{ kind: 'task', id: 't1', title: 'Read', task }])
    expect(groupItemsByDate(base).size).toBe(0)
  })
})
