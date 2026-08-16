'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Account } from '@/lib/types'

export interface AccountFormValues {
  name: string
  opening_balance_minor_units: number
  currency: string
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-secondary-container'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

// Creates/edits a manual account only — Starling accounts are created and
// named by the sync route (see app/api/starling/sync/route.ts) and never
// go through this form. Currency isn't exposed here: formatPounds() only
// ever renders £, so a manual account is always created as GBP rather
// than offering a field that would silently mislabel the symbol.
export default function AccountFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Account> | null
  onSave: (values: AccountFormValues) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? '')
      setOpeningBalance(
        initialValues?.opening_balance_minor_units != null
          ? (initialValues.opening_balance_minor_units / 100).toFixed(2)
          : ''
      )
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          const minorUnits = openingBalance.trim() ? Math.round(Number(openingBalance) * 100) : 0
          if (Number.isNaN(minorUnits)) return
          onSave({ name: name.trim(), opening_balance_minor_units: minorUnits, currency: 'GBP' })
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className={labelClass}>
          Account name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Barclays Current Account"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Opening balance (£)
          <input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <p className="text-xs text-on-surface-variant">
          The balance immediately before the earliest transaction you&apos;ll add for this account.
        </p>

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
            className="rounded-lg bg-secondary-container px-3 py-1.5 text-sm font-medium text-on-secondary-container hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
