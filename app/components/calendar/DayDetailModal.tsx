import { X } from 'lucide-react'
import type { RoutineInstance, Task } from '@/lib/types'
import Modal from '../Modal'
import { formatDayHeading, type DayItem } from './calendarItems'
import DayItemsList from './DayItemsList'

export default function DayDetailModal({
  dateKey,
  items,
  onClose,
  onSelectTask,
  onSelectRoutineInstance,
}: {
  dateKey: string
  items: DayItem[]
  onClose: () => void
  onSelectTask: (task: Task) => void
  onSelectRoutineInstance: (instance: RoutineInstance) => void
}) {
  return (
    <Modal onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="calendar-day-dialog" className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <h2 id="calendar-day-dialog" className="font-display text-base font-semibold text-on-surface">{formatDayHeading(dateKey)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <DayItemsList items={items} onSelectTask={onSelectTask} onSelectRoutineInstance={onSelectRoutineInstance} />
      </div>
    </Modal>
  )
}
