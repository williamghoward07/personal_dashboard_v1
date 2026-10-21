'use client'

import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import Modal from '../../Modal'
import { useTodoLists } from '@/lib/todos/use-todo-lists'
import { useWorkspaceLookup } from '@/lib/workspaces/use-workspace-lookup'
import type { Todo } from '@/lib/types'

export interface TodoFormValues {
  title: string
  due_date: string | null
  due_time: string | null
  notes: string | null
  list_id: string | null
  workspace_id: string | null
  starred: boolean
}

const EMPTY: TodoFormValues = {
  title: '',
  due_date: '',
  due_time: '',
  notes: '',
  list_id: null,
  workspace_id: null,
  starred: false,
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary-container'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

// The one todo editor, used everywhere a todo can be edited: the Todos
// page, the home checklist, a workspace's next actions and Education notes
// documents. Saving goes through each caller's hook, which pushes the
// change to Microsoft To Do (title, notes, date, reminder time, list, star).
export default function TodoFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Todo> | null
  onSave: (values: TodoFormValues) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<TodoFormValues>(EMPTY)
  const { lists } = useTodoLists()
  const workspaceLookup = useWorkspaceLookup()
  // Archived workspaces are hidden from the picker unless the todo is
  // already filed under one.
  const workspaceOptions = useMemo(
    () =>
      [...workspaceLookup.values()]
        .filter((w) => !w.archived || w.id === values.workspace_id)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [workspaceLookup, values.workspace_id]
  )

  useEffect(() => {
    if (isOpen) {
      setValues({
        title: initialValues?.title ?? '',
        due_date: initialValues?.due_date ?? '',
        due_time: initialValues?.due_time ?? '',
        notes: initialValues?.notes ?? '',
        list_id: initialValues?.list_id ?? null,
        workspace_id: initialValues?.workspace_id ?? null,
        starred: initialValues?.starred ?? false,
      })
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!values.title.trim()) return
          onSave({
            title: values.title.trim(),
            due_date: values.due_date || null,
            due_time: values.due_date ? values.due_time || null : null,
            notes: values.notes || null,
            list_id: values.list_id,
            workspace_id: values.workspace_id,
            starred: values.starred,
          })
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>
          <button
            type="button"
            onClick={() => setValues((v) => ({ ...v, starred: !v.starred }))}
            aria-pressed={values.starred}
            aria-label={values.starred ? 'Unstar' : 'Star'}
            title={values.starred ? 'Starred (Important in To Do)' : 'Star (Important in To Do)'}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Star className={`h-4 w-4 ${values.starred ? 'fill-people-amber text-people-amber' : ''}`} />
          </button>
        </div>

        <label className={labelClass}>
          Title
          <input
            autoFocus
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className={inputClass}
          />
        </label>

        <div className="flex gap-3">
          <label className={labelClass}>
            Due date
            <input
              type="date"
              value={values.due_date ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, due_date: e.target.value, due_time: e.target.value ? v.due_time : '' }))}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Time (reminder)
            <input
              type="time"
              value={values.due_time ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, due_time: e.target.value }))}
              disabled={!values.due_date}
              className={`${inputClass} disabled:opacity-40`}
            />
          </label>
        </div>

        <label className={labelClass}>
          List
          <select
            value={values.list_id ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, list_id: e.target.value || null }))}
            className={inputClass}
          >
            <option value="">No list</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Workspace
          <select
            value={values.workspace_id ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, workspace_id: e.target.value || null }))}
            className={inputClass}
          >
            <option value="">No workspace</option>
            {workspaceOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
                {w.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Notes
          <textarea
            value={values.notes ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            rows={3}
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
