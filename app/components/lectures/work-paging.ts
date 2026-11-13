// Staged "show more" for the work list. Pure; every day is a London day key.
//
// Upcoming (soonest first, undated last) opens on its first 10 rows, then
// grows by calendar window: everything due within 3 months of today, within
// 12 months, then everything left. A stage that would reveal nothing is
// skipped. Past due and Completed have only the first 10 and "Show all".

import { londonToday } from '@/lib/blackboard/dates'
import type { WorkItem, WorkTab } from '@/lib/blackboard/work'

export const WORK_PAGE_SIZE = 10

/** 0 = first 10 rows, 1 = within 3 months, 2 = within 12 months, 3 = everything. */
export type WorkStage = 0 | 1 | 2 | 3

export interface WorkNext {
  label: string
  /** How many more rows this button reveals. */
  count: number
  stage: WorkStage
}

const STAGE_LABEL: Record<Exclude<WorkStage, 0>, string> = {
  1: 'Show more',
  2: 'Show the next year',
  3: 'Show all',
}

/** `dateKey` plus whole calendar months, clamped to the end of a shorter month (31 Aug + 3 → 30 Nov). */
function addMonths(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const index = y * 12 + (m - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate() // day 0 of the next month
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/**
 * How many of the (sorted) rows are visible at each stage: at least the
 * first 10, plus every dated row inside the stage's window.
 */
function visibleCounts(items: WorkItem[], tab: WorkTab, now: Date): Record<WorkStage, number> {
  const total = items.length
  const first = Math.min(WORK_PAGE_SIZE, total)
  if (tab !== 'upcoming') return { 0: first, 1: first, 2: first, 3: total }
  const today = londonToday(now)
  const within = (months: number) => {
    const end = addMonths(today, months)
    return items.filter((i) => i.dueOn !== null && i.dueOn <= end).length
  }
  return { 0: first, 1: Math.max(first, within(3)), 2: Math.max(first, within(12)), 3: total }
}

/** The rows to show at `stage`, and the next button (null when nothing is left to reveal). */
export function pageWork(
  items: WorkItem[],
  tab: WorkTab,
  now: Date,
  stage: WorkStage
): { visible: WorkItem[]; next: WorkNext | null } {
  const counts = visibleCounts(items, tab, now)
  const shown = counts[stage]
  const nextStage = ([1, 2, 3] as const).find((s) => s > stage && counts[s] > shown)
  return {
    visible: items.slice(0, shown),
    next: nextStage ? { label: STAGE_LABEL[nextStage], count: counts[nextStage] - shown, stage: nextStage } : null,
  }
}
