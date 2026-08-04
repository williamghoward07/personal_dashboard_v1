'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import TransactionFormModal from './TransactionFormModal'

export default function TransactionsList({
  transactions,
  loading,
  onChange,
}: {
  transactions: Transaction[]
  loading: boolean
  onChange: () => void
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null)

  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <>
      <WidgetCard
        title="Transactions"
        accent="blue"
        className="sm:col-span-2 xl:col-span-4"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add transaction"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-secondary-container"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : sorted.length === 0 ? (
          <p>No transactions logged yet — add one to get started.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant p-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-on-surface">
                    {t.category}
                    {t.description ? ` — ${t.description}` : ''}
                  </span>
                  <span className="text-xs text-on-surface-variant">{t.date}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      t.type === 'income' ? 'text-primary-container' : 'text-on-surface'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}£{t.amount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingTx(t)}
                    aria-label={`Edit ${t.category} transaction`}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingTx(t)}
                    aria-label={`Delete ${t.category} transaction`}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      <TransactionFormModal
        isOpen={isAddOpen}
        heading="New transaction"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          await supabase.from('transactions').insert(values)
          setIsAddOpen(false)
          onChange()
        }}
      />

      <TransactionFormModal
        isOpen={editingTx !== null}
        heading="Edit transaction"
        initialValues={editingTx}
        onClose={() => setEditingTx(null)}
        onSave={async (values) => {
          if (!editingTx) return
          await supabase.from('transactions').update(values).eq('id', editingTx.id)
          setEditingTx(null)
          onChange()
        }}
      />

      <ConfirmDialog
        isOpen={deletingTx !== null}
        message={`Delete this ${deletingTx?.category} transaction? This can't be undone.`}
        onCancel={() => setDeletingTx(null)}
        onConfirm={async () => {
          if (!deletingTx) return
          await supabase.from('transactions').delete().eq('id', deletingTx.id)
          setDeletingTx(null)
          onChange()
        }}
      />
    </>
  )
}
