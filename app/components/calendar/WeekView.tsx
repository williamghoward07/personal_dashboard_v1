import type { RoutineInstance, Task } from '@/lib/types'
import type { DayItem, EventSpan } from './calendarItems'
import { addDaysToKey } from './calendarItems'
import WeekGridView from './WeekGridView'

export default function WeekView({
  mondayKey,
  itemsByDate,
  spans,
  todayKey,
  pxPerMin,
  onSelectDate,
  onSelectTask,
  onSelectRoutineInstance,
}: {
  mondayKey: string
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  pxPerMin: number
  onSelectDate: (dateKey: string) => void
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(mondayKey, i))

  return (
    <WeekGridView
      weekKeys={weekKeys}
      itemsByDate={itemsByDate}
      spans={spans}
      todayKey={todayKey}
      pxPerMin={pxPerMin}
      onSelectDate={onSelectDate}
      onSelectTask={onSelectTask}
      onSelectRoutineInstance={onSelectRoutineInstance}
    />
  )
}
