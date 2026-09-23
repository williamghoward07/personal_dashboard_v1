import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem } from './calendarItems'
import DayItemsList from './DayItemsList'

function formatDateHeading(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// Chronological "Schedule"-style agenda: one heading + DayItemsList per
// date that actually has something on it, skipping empty days entirely —
// matches Google Calendar's own Schedule view. Reuses DayItemsList as-is
// so agenda rows behave identically to the existing day-detail list
// (same click-through for tasks/routines).
export default function AgendaView({
  dateKeys,
  itemsByDate,
  todayKey,
  onSelectTask,
  onSelectRoutineInstance,
}: {
  dateKeys: string[]
  itemsByDate: Map<string, DayItem[]>
  todayKey: string
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const nonEmpty = dateKeys.filter((key) => (itemsByDate.get(key) ?? []).length > 0)

  if (nonEmpty.length === 0) {
    return <p className="text-sm text-on-surface-variant">Nothing scheduled.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {nonEmpty.map((dateKey) => (
        <div key={dateKey}>
          <h4
            className={`label-caps pb-1.5 ${
              dateKey === todayKey ? 'text-secondary-container' : 'text-on-surface-variant'
            }`}
          >
            {dateKey === todayKey ? 'Today' : formatDateHeading(dateKey)}
          </h4>
          <DayItemsList
            items={itemsByDate.get(dateKey) ?? []}
            onSelectTask={onSelectTask}
            onSelectRoutineInstance={onSelectRoutineInstance}
          />
        </div>
      ))}
    </div>
  )
}
