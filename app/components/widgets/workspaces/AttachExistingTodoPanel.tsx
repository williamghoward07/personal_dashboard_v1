'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Todo } from '@/lib/types'
import { ghostButtonClass, primaryButtonClass } from './shared'

// Candidate pool is todos with no workspace yet — a todo already in a
// different workspace is never offered here, since attaching it would
// silently move it out of that other workspace (no such reassignment UI
// exists). To Do-synced todos are attachable like any other — workspace_id
// is app-only and never touched by the To Do pull.
export default function AttachExistingTodoPanel({
  onAttach,
  onClose,
}: {
  onAttach: (todoIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const [candidates, setCandidates] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase
      .from('todos')
      .select('*')
      .is('workspace_id', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCandidates((data ?? []) as Todo[])
        setLoading(false)
      })
  }, [])

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
        Attach an existing todo
      </p>

      {loading ? (
        <p className="text-xs text-on-surface-variant">Loading...</p>
      ) : candidates.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No unassigned todos to attach.</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {candidates.map((todo) => (
            <li key={todo.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-on-surface hover:bg-surface-container-high">
                <input
                  type="checkbox"
                  checked={selected.has(todo.id)}
                  onChange={() => toggle(todo.id)}
                  className="accent-ws-accent"
                />
                <span className="truncate">{todo.title}</span>
                {todo.mstodo_task_id && (
                  <span className="shrink-0 rounded-full border border-outline-variant px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                    To Do
                  </span>
                )}
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
