'use client'

import { useMemo, useState } from 'react'
import type { Todo } from '@/lib/types'
import { ghostButtonClass, primaryButtonClass } from './shared'

// Inline checklist for attaching this workspace's todos to a link. Logic
// ported from ResearchAttachModal.tsx, rendered inline rather than wrapped
// in the styled <Modal> — attachment is a small, in-place action.
export default function LinkTodoAttachPanel({
  todos,
  alreadyAttachedTodoIds,
  onAttach,
  onClose,
}: {
  todos: Todo[]
  alreadyAttachedTodoIds: string[]
  onAttach: (todoIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const available = useMemo(
    () => todos.filter((t) => !alreadyAttachedTodoIds.includes(t.id)),
    [todos, alreadyAttachedTodoIds]
  )

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest/60 p-2.5">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70">
        Attach todos
      </p>

      {available.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No workspace todos available to attach.</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {available.map((todo) => (
            <li key={todo.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-on-surface hover:bg-surface-container-high">
                <input
                  type="checkbox"
                  checked={selected.has(todo.id)}
                  onChange={() => toggle(todo.id)}
                  className="accent-workspace-teal"
                />
                <span className="truncate">{todo.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onAttach(Array.from(selected))}
          className={primaryButtonClass}
        >
          Attach
        </button>
      </div>
    </div>
  )
}
