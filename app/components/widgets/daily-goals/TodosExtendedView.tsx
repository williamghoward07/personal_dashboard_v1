'use client'

import type { Todo } from '@/lib/types'
import { groupTodosForExtendedView, type ExtendedViewGroups } from '@/lib/todos/extended-view'
import type { WorkspaceTag } from '@/lib/workspaces/use-workspace-lookup'
import TodoRow from './TodoRow'

const SECTIONS: { key: keyof ExtendedViewGroups; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'later', label: 'Later' },
  { key: 'noDate', label: 'No date' },
]

export default function TodosExtendedView({
  todos,
  todayDateKey,
  workspaces,
  onToggle,
  onToggleStar,
  onOpen,
  onEdit,
  onDelete,
}: {
  todos: Todo[]
  todayDateKey: string
  workspaces: Map<string, WorkspaceTag>
  onToggle: (id: string) => void
  onToggleStar: (id: string) => void
  onOpen: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}) {
  const groups = groupTodosForExtendedView(todos, todayDateKey)
  const hasAny = SECTIONS.some(({ key }) => groups[key].length > 0)

  if (!hasAny) {
    return <p className="text-sm text-on-surface-variant">Nothing due soon.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map(({ key, label }) => {
        const group = groups[key]
        if (group.length === 0) return null
        return (
          <div key={key}>
            <h3 className="pb-1 text-xs font-semibold text-on-surface-variant">{label}</h3>
            <ul className="flex flex-col divide-y divide-outline-variant/40">
              {group.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  todayDateKey={todayDateKey}
                  workspace={todo.workspace_id ? workspaces.get(todo.workspace_id) : undefined}
                  onToggle={() => onToggle(todo.id)}
                  onToggleStar={() => onToggleStar(todo.id)}
                  onOpen={() => onOpen(todo)}
                  onEdit={() => onEdit(todo)}
                  onDelete={() => onDelete(todo)}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
