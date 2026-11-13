'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { ToggleChips } from '@/components/ui/toggle-chips'
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LABEL,
  WORK_TABS,
  applyWorkFilter,
  workLists,
  type WorkCategory,
  type WorkItem,
  type WorkTab,
} from '@/lib/blackboard/work'
import { notifyLecturesChanged } from '@/lib/lectures/events'
import { saveSessionState, type SessionStatePatch } from '@/lib/lectures/prep-writes'
import type { WorkFilterSetting } from '@/lib/settings/schema'
import { useSettings } from '@/lib/settings/use-settings'
import { ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import { formatSessionDay } from '@/lib/timetable/format'
import { addCounts, type SessionWithPrep } from '@/lib/timetable/session'
import { cn } from '@/lib/utils/cn'
import HandInButton, { CONFIRM_MS } from './HandInButton'
import SessionRow from './SessionRow'
import WorkRow from './WorkRow'

const DAY_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 20
const ALL_MODULES = 'all'

const TAB_LABEL: Record<WorkTab, string> = {
  upcoming: 'Upcoming',
  pastDue: 'Past due',
  completed: 'Completed',
}

const TAB_EMPTY: Record<WorkTab, string> = {
  upcoming: 'Nothing left to do.',
  pastDue: 'Nothing past due.',
  completed: 'Nothing marked as done yet.',
}

const FIRST_RUN = 'Nothing synced from Blackboard yet. Open Blackboard in Chrome and press Sync now in the extension.'

/** "Due yesterday" / "Due 3 days ago" — from the session's end, as the Teams past-due list does. */
function overdueLabel(session: SessionWithPrep, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(session.end ?? session.start).getTime()) / DAY_MS)
  if (days < 1) return 'Due today'
  return days === 1 ? 'Due yesterday' : `Due ${days} days ago`
}

/** What stands between an overdue session and green. Follow-up never makes it overdue. */
function outstanding(session: SessionWithPrep): string {
  const prep = addCounts(session.readings, session.tasks.prep)
  if (session.status === 'red') return 'no prep added'
  const left = prep.total - prep.done
  return left > 0 ? `${left} prep left` : 'not marked as done'
}

/** A module workspace opens on everything upcoming for that module. */
const LOCKED_DEFAULT: WorkFilterSetting = { tab: 'upcoming', categories: 'all', modules: 'all' }

/**
 * Everything there is to do, as one Teams-style list: Upcoming / Past due /
 * Completed, narrowed by type chips (lecture prep is one of them) and, on
 * /lectures, by module. Tab, types and module are remembered in
 * `settings.work_filter`. With `lockedModule` it's one module's list: the
 * module filter is gone, and tab and types are this view's own (starting on
 * everything, lectures included) so switching lecture prep off on /lectures
 * never empties a module workspace's lecture list.
 */
export default function WorkList({
  items,
  now,
  accent,
  loading = false,
  error,
  lockedModule,
  title,
}: {
  items: WorkItem[]
  /** Fixed by the caller: "now" shouldn't re-sort rows mid-click. */
  now: Date
  accent: UiAccent
  loading?: boolean
  /** A failed Blackboard read, shown above the list. */
  error?: string | null
  /** A module workspace's code: hides the module filter and lists only that module. */
  lockedModule?: string
  /** Left of the tabs in the header. */
  title?: ReactNode
}) {
  const { settings, updateSettings } = useSettings()
  // Instant feedback while the save is in flight (and when nothing is saved
  // yet): the stored filter once settings load, defaults until then.
  const [override, setOverride] = useState<WorkFilterSetting | null>(null)
  const filter = override ?? (lockedModule ? LOCKED_DEFAULT : settings.work_filter)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const setFilter = (patch: Partial<WorkFilterSetting>) => {
    const next = { ...filter, ...patch }
    setOverride(next)
    // A module workspace's filter is local to the page: nothing is stored.
    if (!lockedModule) void updateSettings({ work_filter: next })
  }

  const base = useMemo(
    () => (lockedModule ? items.filter((i) => i.moduleCode === lockedModule) : items),
    [items, lockedModule]
  )
  const hasBlackboard = base.some((i) => i.source === 'assignment' || i.source === 'key_date')

  const categories = useMemo<readonly WorkCategory[]>(
    () => (filter.categories === 'all' ? WORK_CATEGORIES : filter.categories),
    [filter.categories]
  )
  const categoryItems = useMemo(
    () => applyWorkFilter(base, { categories: filter.categories, modules: 'all' }),
    [base, filter.categories]
  )

  // One chip per module code. A stored module that has gone falls back to All.
  const modules = useMemo(() => {
    const byCode = new Map<string, string | null>()
    for (const item of base) {
      if (item.moduleCode && !byCode.has(item.moduleCode)) byCode.set(item.moduleCode, item.courseName)
    }
    return [...byCode].sort(([a], [b]) => a.localeCompare(b))
  }, [base])
  const storedModule = !lockedModule && filter.modules !== 'all' ? filter.modules[0] : undefined
  const activeModule = modules.some(([code]) => code === storedModule) ? (storedModule as string) : null
  const showModuleFilter = !lockedModule && modules.length > 1

  // Past-due count per module, for the module chips: where the queue is.
  const pastDueByCode = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of workLists(categoryItems, now).pastDue) {
      if (item.moduleCode) counts.set(item.moduleCode, (counts.get(item.moduleCode) ?? 0) + 1)
    }
    return counts
  }, [categoryItems, now])
  const totalPastDue = [...pastDueByCode.values()].reduce((a, b) => a + b, 0)

  // Lists for the chosen module, before the type chips: they count against these.
  const moduleItems = useMemo(
    () => (activeModule ? base.filter((i) => i.moduleCode === activeModule) : base),
    [base, activeModule]
  )
  const moduleLists = useMemo(() => workLists(moduleItems, now), [moduleItems, now])
  const lists = useMemo(() => {
    const picked = new Set<WorkCategory>(categories)
    return Object.fromEntries(
      WORK_TABS.map((tab) => [tab, moduleLists[tab].filter((i) => picked.has(i.category))])
    ) as Record<WorkTab, WorkItem[]>
  }, [moduleLists, categories])

  const tab = filter.tab
  const tabList = lists[tab]
  const listKey = [tab, activeModule ?? ALL_MODULES, categories.join(',')].join('|')
  const shown = expandedKey === listKey ? tabList : tabList.slice(0, LIST_LIMIT)

  const chipCounts = useMemo(() => {
    const counts = new Map<WorkCategory, number>()
    for (const item of moduleLists[tab]) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    return counts
  }, [moduleLists, tab])

  // Hand in from the past-due list without opening the session. The
  // refetch waits for the button's confirmation, or the row would vanish
  // mid-animation.
  const quickComplete = async (s: SessionWithPrep, patch: SessionStatePatch) => {
    setCompleteError(null)
    try {
      await Promise.all([saveSessionState(s, patch), new Promise((resolve) => setTimeout(resolve, CONFIRM_MS))])
      notifyLecturesChanged()
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const showModule = !lockedModule && !activeModule

  const row = (item: WorkItem) => {
    const session = item.session
    if (session && (item.source === 'prep' || item.source === 'session')) {
      const pastDue = tab === 'pastDue' && item.source === 'prep'
      return (
        <SessionRow
          key={item.key}
          session={session}
          status={session.status}
          postStatus={session.postStatus}
          prep={addCounts(session.readings, session.tasks.prep)}
          showModule={showModule}
          aside={
            pastDue ? (
              <span className="flex w-44 shrink-0 flex-col items-end text-right leading-tight">
                <span className={cn('text-[11px] font-semibold', ACCENT_TEXT.crimson)}>{overdueLabel(session, now)}</span>
                <span className="truncate text-[11px] text-on-surface-variant">{outstanding(session)}</span>
              </span>
            ) : session.prepDone && item.source === 'prep' ? (
              <span className={cn('w-44 shrink-0 text-right text-[11px] font-semibold', ACCENT_TEXT.mint)}>
                Done{session.prepDoneAt ? ` ${formatSessionDay(session.prepDoneAt)}` : ''}
              </span>
            ) : null
          }
          action={
            pastDue && (
              <HandInButton prepDone={false} accent={accent} onSaveState={(patch) => void quickComplete(session, patch)} />
            )
          }
        />
      )
    }
    return <WorkRow key={item.key} item={item} now={now} accent={accent} showModule={showModule} />
  }

  const emptyText = !hasBlackboard ? FIRST_RUN : categories.length === 0 ? 'Pick a type above to see work.' : TAB_EMPTY[tab]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ?? <span />}
        <FilterTabs
          size="compact"
          accent={tab === 'pastDue' ? 'crimson' : accent}
          aria-label="Show work"
          value={tab}
          onChange={(value) => setFilter({ tab: value })}
          options={WORK_TABS.map((value) => ({
            value,
            label: TAB_LABEL[value],
            count: lists[value].length,
          }))}
        />
      </div>
      {showModuleFilter && (
        <FilterTabs
          size="compact"
          accent={accent}
          aria-label="Filter by module"
          className="max-w-full flex-wrap"
          value={activeModule ?? ALL_MODULES}
          onChange={(value) => setFilter({ modules: value === ALL_MODULES ? 'all' : [value] })}
          options={[
            { value: ALL_MODULES, label: 'All', count: totalPastDue || undefined },
            ...modules.map(([code, name]) => ({
              value: code,
              label: <span title={name ?? code}>{code}</span>,
              count: pastDueByCode.get(code) || undefined,
            })),
          ]}
        />
      )}
      <ToggleChips
        accent={accent}
        aria-label="Filter by type"
        value={categories}
        onChange={(value) => setFilter({ categories: value.length === WORK_CATEGORIES.length ? 'all' : value })}
        options={WORK_CATEGORIES.map((value) => ({
          value,
          label: WORK_CATEGORY_LABEL[value],
          count: chipCounts.get(value) ?? 0,
        }))}
      />
      {[error, completeError].map(
        (message) =>
          message && (
            <p key={message} role="alert" className="text-xs text-error">
              {message}
            </p>
          )
      )}
      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (
        <>
          {!hasBlackboard && tabList.length > 0 && <p className="text-sm text-on-surface-variant">{FIRST_RUN}</p>}
          {tabList.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{emptyText}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">{shown.map(row)}</ul>
          )}
        </>
      )}
      {tabList.length > shown.length && (
        <Button variant="ghost" size="sm" accent={accent} className="self-start" onClick={() => setExpandedKey(listKey)}>
          Show all {tabList.length}
        </Button>
      )}
    </div>
  )
}
