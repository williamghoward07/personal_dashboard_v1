'use client'

import { Cloud, Pencil, Trash2 } from 'lucide-react'
import { CountBadge } from '@/components/ui/count-badge'
import type { Todo } from '@/lib/types'
import type { WorkspaceTag } from '@/lib/workspaces/use-workspace-lookup'
import { formatDue } from '@/lib/todos/format'
import { isSyncedTodo } from '@/lib/todos/patch'
import StarButton from './StarButton'
import styles from './TodoRow.module.css'

export default function TodoRow({
  todo,
  todayDateKey,
  subtaskCount,
  workspace,
  listName,
  selected = false,
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
  listName?: string
  selected?: boolean
  onToggle: () => void
  onToggleStar: () => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const completed = todo.completed_at !== null
  const due = formatDue(todo, todayDateKey)

  return (
    <li
      aria-current={selected ? 'true' : undefined}
      className={`${styles.row} ${selected ? styles.selected : ''}`}
    >
      <label className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={completed}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          aria-label={`Mark "${todo.title}" ${completed ? 'incomplete' : 'complete'}`}
          className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-primary-container checked:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50"
        />
      </label>
      <button type="button" className={styles.content} onClick={(event) => {
        event.currentTarget.focus()
        onOpen()
      }}>
        <span className="flex items-start gap-1.5">
          {isSyncedTodo(todo) && (
            <Cloud className="h-3 w-3 shrink-0 text-on-surface-variant" aria-label="Synced with Microsoft To Do" />
          )}
          <span className={`${styles.title} ${completed ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
            {todo.title}
          </span>
          {!!subtaskCount && <CountBadge count={subtaskCount} className="shrink-0" />}
        </span>
        <span className={styles.context}>
          {workspace && <span>{workspace.title}</span>}
          {listName && <span>{workspace ? '· ' : ''}{listName}</span>}
          {due && <span className={styles.mobileDue}>{workspace || listName ? '· ' : ''}{due.label}</span>}
        </span>
        {todo.notes && <span className="block truncate text-xs text-on-surface-variant">{todo.notes}</span>}
      </button>
      {due && <span className={`${styles.desktopDue} ${due.overdue ? 'text-academic-orange' : 'text-on-surface-variant'}`}>{due.label}</span>}
      <StarButton starred={todo.starred} title={todo.title} onToggle={onToggleStar} alwaysShow largeTarget />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        aria-label={`Edit ${todo.title}`}
        className="hidden shrink-0 rounded p-2 text-on-surface-variant sm:block hover:bg-surface-container-high hover:text-on-surface"
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
        className="hidden shrink-0 rounded p-2 text-on-surface-variant sm:block hover:bg-surface-container-high hover:text-error"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}
