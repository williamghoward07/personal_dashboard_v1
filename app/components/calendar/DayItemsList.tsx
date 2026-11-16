import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem } from './calendarItems'
import { calendarItemSession, dotClassFor, formatSpanEnd, formatTime } from './calendarItems'
import { DeadlineButton } from './DeadlinePopover'
import PrepLight from '../lectures/PrepLight'
import { useOpenSession } from '../lectures/SessionPopover'

export default function DayItemsList({
  items,
  emptyMessage = 'Nothing on this day.',
  onSelectTask,
  onSelectRoutineInstance,
}: {
  items: DayItem[]
  emptyMessage?: string
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const openSession = useOpenSession()

  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">{emptyMessage}</p>
  }

  return (
    <ul className="divide-y divide-outline-variant/70 text-sm">
      {items.map((item) => {
        // All-day calendar items read as "blocked out" — a shaded full-width
        // row — rather than a plain dot+title line, same distinction the
        // month/week grid draws between bars and timed list rows.
        if (item.kind === 'calendar' && item.allDay) {
          return (
            <li
              key={`${item.kind}-${item.id}`}
              className="flex items-center gap-2 px-2 py-2"
            >
              <span className="size-2 shrink-0 rounded-full bg-habit-purple/65" aria-hidden="true" />
              <span className="min-w-0 text-on-surface">{item.title}</span>
              {item.spanStartKey !== item.spanEndKey && (
                <span className="shrink-0 text-[11px] text-on-surface-variant">
                  until {formatSpanEnd(item.spanEndKey)}
                </span>
              )}
            </li>
          )
        }

        return (
          <li key={`${item.kind}-${item.id}`} className="flex items-center gap-2 px-2 py-2">
            {item.kind === 'session' ? (
              <PrepLight status={item.session.status} postStatus={item.session.postStatus} size="sm" />
            ) : (
              <span
                className={item.kind === 'routine' ? 'h-1.5 w-1.5 shrink-0 rounded-full' : `h-1.5 w-1.5 shrink-0 rounded-full ${dotClassFor(item)}`}
                style={item.kind === 'routine' ? { backgroundColor: item.colour } : undefined}
              />
            )}
            {(item.kind === 'calendar' || item.kind === 'routine' || item.kind === 'session') && item.start && (
              <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                {formatTime(item.start)}
              </span>
            )}
            {item.kind === 'task' ? (
              <button
                type="button"
                onClick={() => onSelectTask(item.task)}
                className="min-w-0 text-left text-on-surface hover:underline"
              >
                {item.title}
              </button>
            ) : item.kind === 'deadline' ? (
              <DeadlineButton item={item.item} className="min-w-0 whitespace-normal text-on-surface hover:underline" />
            ) : item.kind === 'session' ? (
              <button
                type="button"
                onClick={(e) => openSession?.(item.session, e.currentTarget)}
                className="min-w-0 text-left text-on-surface hover:underline"
              >
                {item.title}
              </button>
            ) : item.kind === 'routine' ? (
              <button
                type="button"
                onClick={() => onSelectRoutineInstance(item.instance)}
                className="min-w-0 text-left text-on-surface hover:underline"
              >
                {item.title}
              </button>
            ) : item.kind === 'calendar' && calendarItemSession(item) ? (
              <button
                type="button"
                onClick={(e) => {
                  const eventSession = calendarItemSession(item)
                  if (eventSession) openSession?.(eventSession, e.currentTarget)
                }}
                className="min-w-0 text-left text-on-surface hover:underline"
              >
                {item.title}
              </button>
            ) : (
              <span className="min-w-0 text-on-surface">{item.title}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
