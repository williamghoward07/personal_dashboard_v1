'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Transaction, TransactionType } from '@/lib/types'

export interface TransactionFormValues {
  date: string
  amount: number
  category: string
  description: string | null
  type: TransactionType
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-secondary-container'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export default function TransactionFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Transaction> | null
  onSave: (values: TransactionFormValues) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TransactionType>('outgoing')

  useEffect(() => {
    if (isOpen) {
      setDate(initialValues?.date ?? todayISO())
      setAmount(initialValues?.amount != null ? String(initialValues.amount) : '')
      setCategory(initialValues?.category ?? '')
      setDescription(initialValues?.description ?? '')
      setType(initialValues?.type ?? 'outgoing')
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = Number(amount)
          if (!value || value <= 0 || !category.trim()) return
          onSave({
            date,
            amount: value,
            category: category.trim(),
            description: description || null,
            type,
          })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('outgoing')}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
              type === 'outgoing'
                ? 'border-secondary-container/50 bg-secondary-container/10 text-secondary-container'
                : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            Outgoing
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
              type === 'income'
                ? 'border-primary-container/50 bg-primary-container/10 text-primary-container'
                : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            Income
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Date
            <input
              autoFocus
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Amount (£)
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Rent, Food, Transport"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Description (optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-secondary-container px-3 py-1.5 text-sm font-medium text-on-secondary-container hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
