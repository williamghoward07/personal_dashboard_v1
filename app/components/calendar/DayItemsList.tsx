import type { Task } from '@/lib/types'
import type { DayItem } from './calendarItems'
import { DOT_CLASS, formatTime } from './calendarItems'

function formatSpanEnd(endKey: string) {
  return new Date(`${endKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export default function DayItemsList({
  items,
  onSelectTask,
}: {
  items: DayItem[]
  onSelectTask: (task: Task) => void
}) {
  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">Nothing on this day.</p>
  }

  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((item) => {
        // All-day calendar items read as "blocked out" — a shaded full-width
        // row — rather than a plain dot+title line, same distinction the
        // month/week grid draws between bars and timed list rows.
        if (item.kind === 'calendar' && item.allDay) {
          return (
            <li
              key={`${item.kind}-${item.id}`}
              className="flex items-center gap-2 rounded-md border border-on-surface-variant/30 bg-on-surface-variant/10 px-2 py-1.5"
            >
              <span className="truncate text-on-surface">{item.title}</span>
              {item.spanStartKey !== item.spanEndKey && (
                <span className="shrink-0 text-[11px] text-on-surface-variant">
                  until {formatSpanEnd(item.spanEndKey)}
                </span>
              )}
            </li>
          )
        }

        return (
          <li key={`${item.kind}-${item.id}`} className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[item.kind]}`} />
            {item.kind === 'calendar' && item.start && (
              <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                {formatTime(item.start)}
              </span>
            )}
            {item.kind === 'task' ? (
              <button
                type="button"
                onClick={() => onSelectTask(item.task)}
                className="truncate text-left text-on-surface hover:underline"
              >
                {item.title}
              </button>
            ) : (
              <span className="truncate text-on-surface">{item.title}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
