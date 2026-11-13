'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Sparkles } from 'lucide-react'
import { addDays, londonToday } from '@/lib/blackboard/dates'
import { useWorkItems } from '@/lib/blackboard/use-work-items'
import { dueWithin, type WorkItem } from '@/lib/blackboard/work'
import { moduleNameMap } from '../../lectures/module-names'
import { formatDueDay, relativeDueLabel } from '../../lectures/work-format'
import HomeSectionCard from './HomeSectionCard'

const DAYS = 7
const MAX_ROWS = 6

// Deadlines and tests only: lecture prep is the Lectures page's job.
const isDeadlineOrTest = (item: WorkItem) =>
  item.source === 'assignment' || item.source === 'key_date' || (item.source === 'session' && item.category === 'test')

// Lectures and tutorials in the window that have work set for them.
function sessionsWithWork(items: WorkItem[], today: string): number {
  const end = addDays(today, DAYS)
  return items.filter((item) => {
    const type = item.session?.type.trim().toLowerCase()
    return (
      (type === 'lecture' || type === 'tutorial') &&
      !!item.setWork?.length &&
      item.dueOn !== null &&
      item.dueOn >= today &&
      item.dueOn < end
    )
  }).length
}

export default function DueSoonGlance() {
  const { items, loading } = useWorkItems()
  const [now] = useState(() => new Date())

  const { due, names, withWork, today } = useMemo(() => {
    const today = londonToday(now)
    return {
      today,
      due: dueWithin(items, now, DAYS).filter(isDeadlineOrTest),
      names: moduleNameMap(items),
      withWork: sessionsWithWork(items, today),
    }
  }, [items, now])

  const shown = due.slice(0, MAX_ROWS)

  return (
    <HomeSectionCard href="/lectures" title="Due soon" icon={<CalendarClock className="h-4 w-4" />} accent="orange">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.length === 0 ? (
            <p>Nothing due in the next 7 days.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {shown.map((item) => {
                const name = item.moduleCode ? names.get(item.moduleCode) : null
                const moduleLabel = [item.moduleCode, name].filter(Boolean).join(' ')
                return (
                  <li key={item.key} className="flex flex-col gap-0.5 text-on-surface">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {item.ai && (
                          <Sparkles className="h-3 w-3 shrink-0 text-on-surface-variant" aria-label="AI-found" />
                        )}
                        <span className="truncate" title={item.title}>
                          {item.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-on-surface-variant">
                        {relativeDueLabel(item.dueOn as string, today)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                      <span className="truncate">{moduleLabel}</span>
                      <span className="shrink-0 tabular-nums">{formatDueDay(item.dueOn as string)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {due.length > MAX_ROWS && <p className="text-xs">+{due.length - MAX_ROWS} more</p>}
          {withWork > 0 && (
            <p className="text-xs">
              {withWork} {withWork === 1 ? 'session has' : 'sessions have'} work set
            </p>
          )}
        </div>
      )}
    </HomeSectionCard>
  )
}
