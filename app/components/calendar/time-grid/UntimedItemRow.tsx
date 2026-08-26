'use client'

import type { Task } from '@/lib/types'
import type { DayItem } from '../calendarItems'
import { formatSpanEnd } from '../calendarItems'

// A single all-day-strip row — all-day calendar events read as "blocked
// out" (shaded bar), tasks are clickable (opens TaskDetailModal), activity
// sessions are plain text. Routines never reach here (always timed).
export default function UntimedItemRow({ item, onSelectTask }: { item: DayItem; onSelectTask: (task: Task) => void }) {
  if (item.kind === 'calendar' && item.allDay) {
    return (
      <div className="truncate rounded border border-on-surface-variant/30 bg-on-surface-variant/10 px-1.5 py-1 text-[11px] text-on-surface">
        {item.title}
        {item.spanStartKey !== item.spanEndKey && (
          <span className="ml-1 text-on-surface-variant">until {formatSpanEnd(item.spanEndKey)}</span>
        )}
      </div>
    )
  }

  if (item.kind === 'task') {
    return (
      <button
        type="button"
        onClick={() => onSelectTask(item.task)}
        className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-academic-orange hover:bg-surface-container-high"
      >
        {item.title}
      </button>
    )
  }

  return <div className="truncate rounded px-1.5 py-1 text-[11px] text-on-surface-variant">{item.title}</div>
}
