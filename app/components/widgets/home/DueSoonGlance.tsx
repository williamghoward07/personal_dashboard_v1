'use client'

import LoadingSkeleton from '@/app/components/LoadingSkeleton'
import { useMemo, useState, type ReactNode } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { useWorkItems } from '@/lib/blackboard/use-work-items'
import { WORK_CATEGORY_LABEL, type WorkItem } from '@/lib/blackboard/work'
import { prepOverflowCount, priorityLayout, studyPriorities, type HomeWidgetDimensions } from '@/lib/home/widget-content'
import { moduleNameMap } from '../../lectures/module-names'
import { dueTimeLabel, formatDueDay, relativeDueLabel } from '../../lectures/work-format'
import HomeSectionCard from './HomeSectionCard'

function PriorityList({
  title,
  items,
  limit,
  today,
  names,
  overflow,
}: {
  title: string
  items: WorkItem[]
  limit: number
  today: string
  names: ReturnType<typeof moduleNameMap>
  /** Replaces the default "+N more in Lectures" footer. */
  overflow?: ReactNode
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{title}</h3>
      <ul className="divide-y divide-outline-variant/50">
        {items.slice(0, limit).map((item) => {
          const moduleName = item.moduleCode ? names.get(item.moduleCode) ?? item.moduleCode : item.courseName
          const category = item.source === 'prep'
            ? item.setWork?.length ? `${item.setWork.length} work set` : null
            : item.category === 'test' ? 'Test' : WORK_CATEGORY_LABEL[item.category]
          const certainty = item.ai?.status === 'suggested'
            ? 'Date to review'
            : item.ai?.status === 'confirmed'
              ? 'Confirmed date'
              : item.dueFromKeyDateId ? 'Extracted date' : null
          const context = [category, moduleName, certainty].filter(Boolean).join(' · ')
          const due = item.dueOn && [
            formatDueDay(item.dueOn),
            dueTimeLabel(item.dueOn, item.dueAt),
            relativeDueLabel(item.dueOn, today),
          ].filter(Boolean).join(' · ')

          return (
            <li key={item.key} className="min-w-0 space-y-0.5 py-1.5 first:pt-0 last:pb-0">
              <p className="break-words font-medium text-on-surface">{item.title}</p>
              {due && <p className="text-xs tabular-nums text-on-surface-variant">{due}</p>}
              {context && <p className="break-words text-xs text-on-surface-variant">{context}</p>}
            </li>
          )
        })}
      </ul>
      {overflow !== undefined ? overflow : items.length > limit && <p className="mt-2 text-xs">+{items.length - limit} more in Lectures</p>}
    </section>
  )
}

export default function DueSoonGlance(dimensions: HomeWidgetDimensions) {
  const { items, loading, error, timetableError } = useWorkItems()
  const [now] = useState(() => new Date())
  const { deadlines, overdue, prep, names, today } = useMemo(() => ({
    ...studyPriorities(items, now),
    names: moduleNameMap(items),
  }), [items, now])
  const layout = priorityLayout({ deadlines: deadlines.length, prep: prep.length }, dimensions)
  const prepOverflow = prepOverflowCount(prep, layout.prep, today)

  return (
    <HomeSectionCard href="/lectures" title="Study priorities" icon={<BookOpenCheck className="h-4 w-4" />} accent="orange">
      {loading ? <LoadingSkeleton label="Loading study priorities…" /> : (
        <div className="space-y-4">
          <div className={layout.twoColumn ? 'grid grid-cols-2 items-start gap-4' : 'grid gap-4'}>
            {deadlines.length > 0 && <PriorityList title="Upcoming deadlines" items={deadlines} limit={layout.deadlines} today={today} names={names} />}
            {prep.length > 0 && (
              <PriorityList
                title="Upcoming prep"
                items={prep}
                limit={layout.prep}
                today={today}
                names={names}
                overflow={prepOverflow === 0
                  ? prep.length > layout.prep ? <p className="mt-2 text-xs">All prep in Lectures →</p> : null
                  : <p className="mt-2 text-xs">+{prepOverflow} more this fortnight</p>}
              />
            )}
          </div>
          {overdue.length > 0 && <PriorityList title="Overdue deadlines" items={overdue} limit={layout.overdue} today={today} names={names} />}
          {deadlines.length === 0 && prep.length === 0 && overdue.length === 0 && (
            <p>No upcoming deadlines or prep.</p>
          )}
          {(error || (timetableError && timetableError !== 'not_configured')) && (
            <p className="text-xs text-error">Some study data could not be loaded. Check Lectures.</p>
          )}
        </div>
      )}
    </HomeSectionCard>
  )
}
