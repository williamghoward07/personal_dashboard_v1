'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Landmark, Pencil, Pin, Trash2 } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardContent } from '@/components/ui/glass-card'
import LiquidSwitch from '../../LiquidSwitch'
import ConfirmDialog from '../../ConfirmDialog'
import SpacesStrip from './SpacesStrip'
import { useAccounts } from '@/lib/money/use-accounts'
import { useTransactions } from '@/lib/money/use-transactions'
import { useStarlingBalances } from '@/lib/money/use-starling-balances'
import { useSpacePreferences } from '@/lib/money/use-space-preferences'
import { resolveAccountBalance, resolveAccountSpaces, accountNetChangeMinorUnits } from '@/lib/money/accounts'
import { formatPounds, CHANGE_PERIOD_OPTIONS, type ChangePeriod } from '@/lib/money'
import TransactionsList from '../transactions/TransactionsList'
import AccountFormModal, { type AccountFormValues } from './AccountFormModal'

const actionButtonClass =
  'flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container-high'

export default function AccountDetailBoard({ accountId }: { accountId: string }) {
  const router = useRouter()
  const {
    accounts,
    loading: accountsLoading,
    updateManualAccount,
    deleteAccount,
    togglePin,
    toggleHidden,
  } = useAccounts()
  const {
    transactions,
    displayTransactions,
    loading: transactionsLoading,
    refresh: refreshTransactions,
  } = useTransactions(accountId)
  const { state: starlingState } = useStarlingBalances()
  const { isHidden: isSpaceHidden, toggleHidden: toggleSpaceHidden } = useSpacePreferences()

  const [period, setPeriod] = useState<ChangePeriod>('month')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const account = accounts.find((a) => a.id === accountId)

  if (accountsLoading) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    )
  }

  if (!account) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
        <Link href="/money" className="w-fit text-sm text-on-surface-variant hover:text-on-surface hover:underline">
          ← Back to Money
        </Link>
        <p className="text-sm text-on-surface-variant">Account not found.</p>
      </main>
    )
  }

  const starlingBalances =
    starlingState.status === 'ready'
      ? starlingState.balances
      : starlingState.status === 'loading'
        ? 'loading'
        : 'unavailable'
  const balance = resolveAccountBalance(account, transactions, starlingBalances)
  const spaces = resolveAccountSpaces(account, starlingBalances)
  const changeMinorUnits = accountNetChangeMinorUnits(account, transactions, period)
  const isPositive = changeMinorUnits >= 0

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/money"
          className="flex w-fit items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Money
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 font-display text-headline-lg font-bold text-on-surface">
            <Landmark className="h-6 w-6" aria-hidden="true" />
            {account.name}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleHidden(account.id)}
              aria-pressed={account.is_hidden}
              aria-label={account.is_hidden ? 'Unhide account' : 'Hide account'}
              className={`${actionButtonClass} ${account.is_hidden ? 'text-secondary-container' : 'text-on-surface'}`}
            >
              {account.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {account.is_hidden ? 'Hidden' : 'Hide'}
            </button>
            <button
              type="button"
              onClick={() => togglePin(account.id)}
              aria-pressed={account.is_pinned}
              aria-label={account.is_pinned ? 'Unpin account' : 'Pin account'}
              className={`${actionButtonClass} ${account.is_pinned ? 'text-secondary-container' : 'text-on-surface'}`}
            >
              <Pin className={`h-3.5 w-3.5 ${account.is_pinned ? 'fill-current' : ''}`} />
              {account.is_pinned ? 'Pinned' : 'Pin'}
            </button>
            {account.source === 'manual' && (
              <>
                <button type="button" onClick={() => setEditOpen(true)} className={`${actionButtonClass} text-on-surface`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button type="button" onClick={() => setDeleteOpen(true)} className={`${actionButtonClass} text-error`}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        <span className="text-xs text-on-surface-variant">{account.source === 'starling' ? 'Starling' : 'Manual'} account</span>
      </div>

      <ModuleGlassCard accent="blue">
        <GlassCardContent className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {balance === 'loading' ? (
              <div className="h-9 w-32 animate-pulse rounded bg-surface-container-high" />
            ) : balance === 'unavailable' ? (
              <p className="text-sm text-on-surface-variant">Balance unavailable</p>
            ) : (
              <span className="font-display text-3xl font-semibold text-on-surface">
                {formatPounds(balance.minorUnits)}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <LiquidSwitch options={CHANGE_PERIOD_OPTIONS} value={period} onChange={setPeriod} accent="blue" />
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-display text-lg font-semibold ${
                  isPositive ? 'text-primary-container' : 'text-error'
                }`}
              >
                {isPositive ? '+' : ''}
                {formatPounds(changeMinorUnits)}
              </span>
              <span className="text-xs text-on-surface-variant">
                {CHANGE_PERIOD_OPTIONS.find((o) => o.value === period)?.label.toLowerCase()} change
              </span>
            </div>
          </div>
        </GlassCardContent>
      </ModuleGlassCard>

      {Array.isArray(spaces) && spaces.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-semibold text-foreground">
            Spaces <span className="font-normal text-on-surface-variant">— part of the balance above</span>
          </h2>
          <SpacesStrip
            spaces={spaces}
            isHidden={(spaceExternalId) => isSpaceHidden(account.id, spaceExternalId)}
            onToggleHidden={(spaceExternalId) => toggleSpaceHidden(account.id, spaceExternalId)}
            defaultExpanded
          />
        </div>
      )}

      <TransactionsList
        transactions={displayTransactions}
        loading={transactionsLoading}
        onChange={refreshTransactions}
        accounts={accounts}
        fixedAccountId={account.source === 'manual' ? account.id : undefined}
      />

      {account.source === 'manual' && (
        <>
          <AccountFormModal
            isOpen={editOpen}
            heading="Edit account"
            initialValues={account}
            onClose={() => setEditOpen(false)}
            onSave={(values: AccountFormValues) => {
              updateManualAccount(account.id, values)
              setEditOpen(false)
            }}
          />
          <ConfirmDialog
            isOpen={deleteOpen}
            message={`Delete "${account.name}"? This will also delete its ${displayTransactions.length} transaction${
              displayTransactions.length === 1 ? '' : 's'
            }. This can't be undone.`}
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => {
              deleteAccount(account.id)
              setDeleteOpen(false)
              router.push('/money')
            }}
          />
        </>
      )}
    </main>
  )
}
