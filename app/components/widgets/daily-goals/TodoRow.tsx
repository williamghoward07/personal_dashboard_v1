'use client'

import { Cloud, Pencil, Trash2 } from 'lucide-react'
import type { Todo } from '@/lib/types'
import type { WorkspaceTag } from '@/lib/workspaces/use-workspace-lookup'
import { onActivateKey } from '@/lib/utils/a11y'
import WorkspaceChip from '../workspaces/WorkspaceChip'
import StarButton from './StarButton'

export default function TodoRow({
  todo,
  todayDateKey,
  subtaskCount,
  workspace,
  onToggle,
  onToggleStar,
  onOpen,
  onEdit,
  onDelete,
}: {
  todo: Todo
  todayDateKey: string
  subtaskCount?: number
  workspace?: WorkspaceTag
  onToggle: () => void
  onToggleStar: () => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const completed = todo.completed_at !== null
  const overdue = !completed && todo.due_date !== null && todo.due_date < todayDateKey

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onActivateKey(onOpen)}
      className="flex cursor-pointer items-center gap-3 py-2.5"
    >
      <input
        type="checkbox"
        checked={completed}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        aria-label={`Mark "${todo.title}" ${completed ? 'incomplete' : 'complete'}`}
        className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50"
      />
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {todo.mstodo_task_id && (
            <Cloud className="h-3 w-3 shrink-0 text-on-surface-variant" aria-label="Synced with Microsoft To Do" />
          )}
          <span
            className={`block truncate text-sm ${completed ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}
          >
            {todo.title}
          </span>
          {!!subtaskCount && (
            <span className="shrink-0 rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
              {subtaskCount}
            </span>
          )}
          {workspace && <WorkspaceChip workspace={workspace} />}
        </span>
        {todo.notes && <span className="block truncate text-xs text-on-surface-variant">{todo.notes}</span>}
      </div>
      {todo.due_date && (
        <span
          className={`shrink-0 text-xs font-medium ${overdue ? 'text-academic-orange' : 'text-on-surface-variant'}`}
        >
          {overdue ? 'Overdue · ' : ''}
          {todo.due_date}
          {todo.due_time ? ` · ${todo.due_time}` : ''}
        </span>
      )}
      <StarButton starred={todo.starred} title={todo.title} onToggle={onToggleStar} alwaysShow />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        aria-label={`Edit ${todo.title}`}
        className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        aria-label={`Delete ${todo.title}`}
        className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}
