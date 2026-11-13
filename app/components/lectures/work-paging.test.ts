import { describe, expect, it } from 'vitest'
import type { WorkItem } from '@/lib/blackboard/work'
import { pageWork } from './work-paging'

// 14 Nov 2026 noon London (GMT): 3 months on is 14 Feb 2027, 12 months 14 Nov 2027.
const NOW = new Date('2026-11-14T12:00:00Z')

const item = (n: number, dueOn: string | null): WorkItem =>
  ({ key: `k${n}`, dueOn }) as WorkItem

const dated = (days: string[]) => days.map((d, i) => item(i, d))
const soon = (n: number) => dated(Array.from({ length: n }, (_, i) => `2026-11-${String(15 + (i % 10)).padStart(2, '0')}`))

describe('pageWork: Upcoming', () => {
  it('shows everything with no button when there are 10 rows or fewer', () => {
    const items = soon(10)
    const { visible, next } = pageWork(items, 'upcoming', NOW, 0)
    expect(visible).toHaveLength(10)
    expect(next).toBeNull()
  })

  it('shows 10, then Show more reveals everything within 3 months, boundary day included', () => {
    const items = [...soon(10), ...dated(['2027-01-05', '2027-02-14', '2027-02-15', '2027-06-01'])]
    const first = pageWork(items, 'upcoming', NOW, 0)
    expect(first.visible).toHaveLength(10)
    expect(first.next).toEqual({ label: 'Show more', count: 2, stage: 1 })
    const second = pageWork(items, 'upcoming', NOW, 1)
    expect(second.visible.map((i) => i.dueOn)).not.toContain('2027-02-15')
    expect(second.visible).toHaveLength(12)
    expect(second.next).toEqual({ label: 'Show the next year', count: 2, stage: 2 })
  })

  it('then the next year, then Show all for later and undated rows', () => {
    const items = [...soon(10), ...dated(['2027-03-01', '2028-01-01']), item(99, null)]
    const y = pageWork(items, 'upcoming', NOW, 2)
    expect(y.visible).toHaveLength(11)
    expect(y.next).toEqual({ label: 'Show all', count: 2, stage: 3 })
    const all = pageWork(items, 'upcoming', NOW, 3)
    expect(all.visible).toHaveLength(13)
    expect(all.next).toBeNull()
  })

  it('skips a stage that reveals nothing', () => {
    // Nothing between day 10 and 12 months except one row in the year window.
    const items = [...soon(10), ...dated(['2027-08-01'])]
    expect(pageWork(items, 'upcoming', NOW, 0).next).toEqual({ label: 'Show the next year', count: 1, stage: 2 })
    // Nothing dated beyond the first ten at all: straight to Show all.
    const undatedOnly = [...soon(10), item(50, null), item(51, null)]
    expect(pageWork(undatedOnly, 'upcoming', NOW, 0).next).toEqual({ label: 'Show all', count: 2, stage: 3 })
  })

  it('does not hide a row the first 10 already passed the window with', () => {
    const items = dated(Array.from({ length: 12 }, () => '2026-11-20'))
    const { visible, next } = pageWork(items, 'upcoming', NOW, 1)
    expect(visible).toHaveLength(12)
    expect(next).toBeNull()
  })

  it('clamps month ends (30 Nov + 3 months is 28 Feb)', () => {
    const now = new Date('2026-11-30T12:00:00Z')
    const items = [...soon(10), ...dated(['2027-02-28', '2027-03-01'])]
    expect(pageWork(items, 'upcoming', now, 0).next).toEqual({ label: 'Show more', count: 1, stage: 1 })
  })
})

describe('pageWork: Past due and Completed', () => {
  it.each(['pastDue', 'completed'] as const)('%s is the first 10, then one Show all', (tab) => {
    const items = soon(25)
    const first = pageWork(items, tab, NOW, 0)
    expect(first.visible).toHaveLength(10)
    expect(first.next).toEqual({ label: 'Show all', count: 15, stage: 3 })
    expect(pageWork(items, tab, NOW, 3)).toMatchObject({ next: null, visible: { length: 25 } })
  })
  it('has no button for 10 or fewer', () => {
    expect(pageWork(soon(4), 'completed', NOW, 0).next).toBeNull()
  })
})
