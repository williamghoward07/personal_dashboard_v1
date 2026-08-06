import { X } from 'lucide-react'
import type { Task } from '@/lib/types'
import Modal from '../Modal'
import type { DayItem } from './calendarItems'
import DayItemsList from './DayItemsList'

function formatHeading(dateKey: string) {
  // 'YYYY-MM-DD' parsed as UTC and displayed via the London-locale formatter
  // avoids the local-timezone-shift trap of `new Date('YYYY-MM-DD')`.
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export default function DayDetailModal({
  dateKey,
  items,
  onClose,
  onSelectTask,
}: {
  dateKey: string
  items: DayItem[]
  onClose: () => void
  onSelectTask: (task: Task) => void
}) {
  return (
    <Modal onClose={onClose}>
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-base font-bold text-on-surface">{formatHeading(dateKey)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <DayItemsList items={items} onSelectTask={onSelectTask} />
      </div>
    </Modal>
  )
}
