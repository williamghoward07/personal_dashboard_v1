'use client'

import { useMemo, useState } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { londonToday } from '@/lib/blackboard/dates'
import { useWorkItems } from '@/lib/blackboard/use-work-items'
import { dueWithin, workLists, type WorkItem } from '@/lib/blackboard/work'
import { moduleNameMap } from '../../lectures/module-names'
import { formatDueDay, relativeDueLabel } from '../../lectures/work-format'
import HomeSectionCard from './HomeSectionCard'

const DAYS = 7
const MAX_ROWS = 4
const isDeadline = (item: WorkItem) =>
  item.source === 'assignment' || item.source === 'key_date' || (item.source === 'session' && item.category === 'test')

export default function DueSoonGlance() {
  const { items, loading, error, timetableError } = useWorkItems()
  const [now] = useState(() => new Date())
  const { deadlines, prep, names, today } = useMemo(() => {
    const soon = dueWithin(items, now, DAYS)
    const overdue = workLists(items, now).pastDue.filter(isDeadline)
    return {
      today: londonToday(now),
      deadlines: [...overdue, ...soon.filter(isDeadline)],
      prep: soon.filter((item) => item.source === 'prep'),
      names: moduleNameMap(items),
    }
  }, [items, now])

  return (
    <HomeSectionCard href="/lectures" title="Study priorities" icon={<BookOpenCheck className="h-4 w-4" />} accent="orange">
      {loading ? <p>Loading study priorities…</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Deadlines · next 7 days</h3>
            {deadlines.length === 0 ? <p>Nothing due soon.</p> : (
              <ul className="space-y-2">
                {deadlines.slice(0, MAX_ROWS).map((item) => (
                  <li key={item.key} className="border-b border-outline-variant/50 pb-2 last:border-0">
                    <div className="flex items-start justify-between gap-3 text-on-surface">
                      <span className="min-w-0 break-words font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs text-on-surface-variant">{item.dueOn && relativeDueLabel(item.dueOn, today)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {[item.moduleCode, item.moduleCode ? names.get(item.moduleCode) : null, item.dueOn ? formatDueDay(item.dueOn) : null].filter(Boolean).join(' · ')}
                      {item.ai?.status === 'suggested' && ' · Date to review'}
                      {item.dueFromKeyDateId && ' · Extracted date'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {deadlines.length > MAX_ROWS && <p className="mt-2 text-xs">+{deadlines.length - MAX_ROWS} more in Lectures</p>}
          </section>
          <section className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Upcoming prep · next 7 days</h3>
            {prep.length === 0 ? <p>No upcoming prep.</p> : (
              <ul className="space-y-2">
                {prep.slice(0, MAX_ROWS).map((item) => (
                  <li key={item.key} className="border-b border-outline-variant/50 pb-2 last:border-0">
                    <div className="flex items-start justify-between gap-3 text-on-surface">
                      <span className="min-w-0 break-words font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs text-on-surface-variant">{item.dueOn && relativeDueLabel(item.dueOn, today)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{item.moduleCode}{item.setWork?.length ? ` · ${item.setWork.length} work set` : ' · Prep not completed'}</p>
                  </li>
                ))}
              </ul>
            )}
            {prep.length > MAX_ROWS && <p className="mt-2 text-xs">+{prep.length - MAX_ROWS} more in Lectures</p>}
          </section>
          {(error || timetableError) && <p className="text-xs text-error md:col-span-2">Some study data could not be loaded. Open Lectures to check.</p>}
        </div>
      )}
    </HomeSectionCard>
  )
}
