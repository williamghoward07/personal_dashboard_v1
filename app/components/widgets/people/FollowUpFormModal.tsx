'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Person } from '@/lib/types'
import { cancelButtonClass, inputClass, labelClass, saveButtonClass } from './shared'

export interface FollowUpFormValues {
  person_id: string
  note: string
  due_date: string | null
}

export default function FollowUpFormModal({
  isOpen,
  heading,
  people,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  people: Person[]
  initialValues?: Partial<FollowUpFormValues> | null
  onSave: (values: FollowUpFormValues) => void
  onClose: () => void
}) {
  const [personId, setPersonId] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPersonId(initialValues?.person_id ?? '')
      setNote(initialValues?.note ?? '')
      setDueDate(initialValues?.due_date ?? '')
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!personId || !note.trim()) return
          onSave({ person_id: personId, note: note.trim(), due_date: dueDate || null })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className={labelClass}>
          Who
          <select
            autoFocus
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Choose a person
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Bring up next time
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Ask how her Saturday shift went"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Due (optional)
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cancelButtonClass}>
            Cancel
          </button>
          <button type="submit" className={saveButtonClass}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
