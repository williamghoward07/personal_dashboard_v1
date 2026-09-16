'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Task } from '@/lib/types'
import { onActivateKey } from '@/lib/utils/a11y'

export default function TaskCard({
  task,
  onOpen,
  onEdit,
  onDelete,
}: {
  task: Task
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onActivateKey(onOpen)}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-left transition-colors hover:border-academic-orange/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-on-surface">
          {task.title || 'Untitled task'}
        </h4>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            aria-label={`Edit ${task.title}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label={`Delete ${task.title}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
        {task.type && <span>{task.type}</span>}
        {task.due_date && <span>Due {task.due_date}</span>}
        {task.status && <span>{task.status}</span>}
      </div>
    </div>
  )
}
