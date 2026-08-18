'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { Todo } from '@/lib/types'
import TodoRow from './TodoRow'

function completionDateKey(completedAt: string): string {
  return completedAt.slice(0, 10)
}

export default function CompletedTodosList({
  todos,
  todayDateKey,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
}: {
  todos: Todo[]
  todayDateKey: string
  onToggle: (id: string) => void
  onOpen: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}) {
  const todayRef = useRef<HTMLDivElement | null>(null)

  const groups = useMemo(() => {
    const byDate = new Map<string, Todo[]>()
    for (const todo of todos) {
      if (!todo.completed_at) continue
      const key = completionDateKey(todo.completed_at)
      const bucket = byDate.get(key) ?? []
      bucket.push(todo)
      byDate.set(key, bucket)
    }
    for (const bucket of byDate.values()) {
      bucket.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [todos])

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  if (groups.length === 0) {
    return <p className="text-sm text-on-surface-variant">No completed todos yet.</p>
  }

  return (
    <div className="flex max-h-96 flex-col gap-4 overflow-y-auto">
      {groups.map(([dateKey, group]) => (
        <div key={dateKey} ref={dateKey === todayDateKey ? todayRef : undefined}>
          <h3 className="pb-1 text-xs font-semibold text-on-surface-variant">
            {dateKey === todayDateKey ? 'Today' : dateKey}
          </h3>
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {group.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                todayDateKey={todayDateKey}
                onToggle={() => onToggle(todo.id)}
                onOpen={() => onOpen(todo)}
                onEdit={() => onEdit(todo)}
                onDelete={() => onDelete(todo)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
