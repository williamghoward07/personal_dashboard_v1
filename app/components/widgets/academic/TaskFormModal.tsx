'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Task } from '@/lib/types'

export interface TaskFormValues {
  title: string
  type: string | null
  due_date: string | null
  credit_weight: number | null
  status: string | null
  grade: string | null
  notes: string | null
  description: string | null
}

const STATUS_OPTIONS = ['Not started', 'In progress', 'Submitted', 'Done']

const EMPTY: TaskFormValues = {
  title: '',
  type: '',
  due_date: '',
  credit_weight: null,
  status: '',
  grade: '',
  notes: '',
  description: '',
}

export default function TaskFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Task> | null
  onSave: (values: TaskFormValues) => void
  onClose: () => void
}) {
  const [values, setValues] = useState<TaskFormValues>(EMPTY)

  useEffect(() => {
    if (isOpen) {
      setValues({
        title: initialValues?.title ?? '',
        type: initialValues?.type ?? '',
        due_date: initialValues?.due_date ?? '',
        credit_weight: initialValues?.credit_weight ?? null,
        status: initialValues?.status ?? '',
        grade: initialValues?.grade ?? '',
        notes: initialValues?.notes ?? '',
        description: initialValues?.description ?? '',
      })
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!values.title.trim()) return
          onSave({
            ...values,
            title: values.title.trim(),
            due_date: values.due_date || null,
            type: values.type || null,
            status: values.status || null,
            grade: values.grade || null,
            notes: values.notes || null,
            description: values.description || null,
          })
        }}
        className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto"
      >
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          {heading}
        </h2>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Title
          <input
            autoFocus
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Type
            <input
              value={values.type ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              placeholder="e.g. Essay"
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Due date
            <input
              type="date"
              value={values.due_date ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, due_date: e.target.value }))}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Credit weight (%)
            <input
              type="number"
              value={values.credit_weight ?? ''}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  credit_weight: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Status
            <select
              value={values.status ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            >
              <option value="">—</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Grade
          <input
            value={values.grade ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, grade: e.target.value }))}
            placeholder="e.g. 68% or First"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Description
          <textarea
            value={values.description ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            rows={2}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Notes
          <textarea
            value={values.notes ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            rows={2}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white dark:bg-white/80 dark:text-black"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
