import type { WorkspaceSectionKey } from '@/lib/types'

// Which parts of a workspace page are shown, per workspace. "Hidden"
// removes a section (its data is untouched); "collapsed" shrinks it to a
// slim bar. Pure so the adapt-to-what's-visible rules are testable.

export const SECTION_KEYS: WorkspaceSectionKey[] = ['stats', 'sources', 'actions', 'log']

export const SECTION_LABELS: Record<WorkspaceSectionKey, string> = {
  stats: 'Stats',
  sources: 'Sources',
  actions: 'Next actions',
  log: 'Thinking log',
}

export type ColumnSectionKey = Exclude<WorkspaceSectionKey, 'stats'>
export const COLUMN_SECTION_KEYS: ColumnSectionKey[] = ['sources', 'actions', 'log']

export type StatCardKey = 'tasks' | 'footprint' | 'coupling' | 'log'

// A stat card only makes sense while the sections it summarises are shown.
const STAT_CARD_REQUIRES: Record<StatCardKey, ColumnSectionKey[]> = {
  tasks: ['actions'],
  footprint: ['sources'],
  coupling: ['actions', 'sources'],
  log: ['log'],
}
const STAT_CARD_ORDER: StatCardKey[] = ['tasks', 'footprint', 'coupling', 'log']

// Tailwind only generates classes it can see written out in full.
export const COLUMN_GRID_CLASS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
}

export const STAT_GRID_CLASS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
}

export function isShown(hidden: readonly WorkspaceSectionKey[], key: WorkspaceSectionKey): boolean {
  return !hidden.includes(key)
}

export function visibleStatCards(hidden: readonly WorkspaceSectionKey[]): StatCardKey[] {
  if (hidden.includes('stats')) return []
  return STAT_CARD_ORDER.filter((card) => STAT_CARD_REQUIRES[card].every((section) => isShown(hidden, section)))
}

/** The three content columns split into shown-expanded and shown-collapsed. */
export function columnLayout(
  hidden: readonly WorkspaceSectionKey[],
  collapsed: readonly WorkspaceSectionKey[]
): { expanded: ColumnSectionKey[]; collapsed: ColumnSectionKey[] } {
  const shown = COLUMN_SECTION_KEYS.filter((key) => isShown(hidden, key))
  return {
    expanded: shown.filter((key) => !collapsed.includes(key)),
    collapsed: shown.filter((key) => collapsed.includes(key)),
  }
}

/** Adds or removes `key`, keeping the canonical section order. */
export function toggleSection(list: readonly WorkspaceSectionKey[], key: WorkspaceSectionKey): WorkspaceSectionKey[] {
  const next = new Set(list)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return SECTION_KEYS.filter((k) => next.has(k))
}
