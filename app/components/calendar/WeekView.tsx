import type { DayItem, EventSpan } from './calendarItems'
import { addDaysToKey } from './calendarItems'
import WeekRow from './WeekRow'

export default function WeekView({
  mondayKey,
  itemsByDate,
  spans,
  todayKey,
  onSelectDate,
}: {
  mondayKey: string
  itemsByDate: Map<string, DayItem[]>
  spans: EventSpan[]
  todayKey: string
  onSelectDate: (dateKey: string) => void
}) {
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(mondayKey, i))

  return (
    <WeekRow
      weekCells={weekKeys}
      itemsByDate={itemsByDate}
      spans={spans}
      todayKey={todayKey}
      onSelectDate={onSelectDate}
      minHeightClass="min-h-48"
      maxCompactItems={6}
      showWeekdayLabel={true}
    />
  )
}
