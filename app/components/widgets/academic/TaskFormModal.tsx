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

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-academic-orange'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

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
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className={labelClass}>
          Title
          <input
            autoFocus
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Type
            <input
              value={values.type ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              placeholder="e.g. Essay"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Due date
            <input
              type="date"
              value={values.due_date ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, due_date: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
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
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Status
            <select
              value={values.status ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
              className={inputClass}
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

        <label className={labelClass}>
          Grade
          <input
            value={values.grade ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, grade: e.target.value }))}
            placeholder="e.g. 68% or First"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Description
          <textarea
            value={values.description ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Notes
          <textarea
            value={values.notes ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            rows={2}
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
            className="rounded-lg bg-academic-orange px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
