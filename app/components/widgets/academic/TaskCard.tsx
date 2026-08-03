'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Task } from '@/lib/types'

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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-black/10 bg-white/60 p-3 text-left hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-black/80 dark:text-white/80">
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
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
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
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/40 dark:text-white/40">
        {task.type && <span>{task.type}</span>}
        {task.due_date && <span>Due {task.due_date}</span>}
        {task.status && <span>{task.status}</span>}
      </div>
    </div>
  )
}
