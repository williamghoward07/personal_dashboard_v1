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
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          {heading}
        </h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('outgoing')}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
              type === 'outgoing'
                ? 'border-black/30 bg-black/5 text-black dark:border-white/30 dark:bg-white/10 dark:text-white'
                : 'border-black/10 text-black/50 dark:border-white/10 dark:text-white/50'
            }`}
          >
            Outgoing
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
              type === 'income'
                ? 'border-black/30 bg-black/5 text-black dark:border-white/30 dark:bg-white/10 dark:text-white'
                : 'border-black/10 text-black/50 dark:border-white/10 dark:text-white/50'
            }`}
          >
            Income
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Date
            <input
              autoFocus
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
            Amount (£)
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Rent, Food, Transport"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Description (optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>

        <div className="flex justify-end gap-2">
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
