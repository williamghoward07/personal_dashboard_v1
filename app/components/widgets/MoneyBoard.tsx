'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { EyeOff, FileUp, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAccounts } from '@/lib/money/use-accounts'
import { useTransactions } from '@/lib/money/use-transactions'
import { useStarlingBalances } from '@/lib/money/use-starling-balances'
import { useSpacePreferences } from '@/lib/money/use-space-preferences'
import { resolveAccountBalance, resolveAccountSpaces, sortAccounts } from '@/lib/money/accounts'
import AccountCard from './money/AccountCard'
import OverallBalanceCard from './money/OverallBalanceCard'
import AccountFormModal, { type AccountFormValues } from './money/AccountFormModal'
import SpendingBreakdownChart from './SpendingBreakdownChart'
import TransactionsList from './transactions/TransactionsList'

export default function MoneyBoard() {
  const {
    accounts,
    loading: accountsLoading,
    createManualAccount,
    togglePin,
    toggleHidden,
    refresh: refreshAccounts,
  } = useAccounts()
  const {
    transactions,
    displayTransactions,
    loading: transactionsLoading,
    refresh: refreshTransactions,
  } = useTransactions()
  const { state: starlingState, refresh: refreshStarlingBalances } = useStarlingBalances()
  const { isHidden: isSpaceHidden, toggleHidden: toggleSpaceHidden } = useSpacePreferences()

  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('integrations')
      .select('last_synced_at')
      .eq('provider', 'starling')
      .maybeSingle()
      .then(({ data }) => setLastSyncedAt(data?.last_synced_at ?? null))
  }, [])

  const sortedAccounts = useMemo(() => sortAccounts(accounts), [accounts])
  const hiddenAccountsCount = useMemo(() => accounts.filter((a) => a.is_hidden).length, [accounts])

  const starlingBalances =
    starlingState.status === 'ready'
      ? starlingState.balances
      : starlingState.status === 'loading'
        ? 'loading'
        : 'unavailable'

  const accountsWithBalances = useMemo(
    () =>
      sortedAccounts.map((account) => ({
        account,
        balance: resolveAccountBalance(account, transactions, starlingBalances),
        spaces: resolveAccountSpaces(account, starlingBalances),
      })),
    [sortedAccounts, transactions, starlingBalances]
  )

  const syncNow = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/starling/sync', { method: 'POST' })
      if (!res.ok) {
        setSyncError('Sync failed')
      } else {
        refreshTransactions()
        refreshAccounts()
        refreshStarlingBalances()
        supabase
          .from('integrations')
          .select('last_synced_at')
          .eq('provider', 'starling')
          .maybeSingle()
          .then(({ data }) => setLastSyncedAt(data?.last_synced_at ?? null))
      }
    } catch {
      setSyncError('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <OverallBalanceCard
        accountsWithBalances={accountsWithBalances}
        accounts={accounts}
        transactions={transactions}
        onSync={syncNow}
        syncing={syncing}
        syncError={syncError}
        lastSyncedAt={lastSyncedAt}
      />

      {accountsLoading ? (
        <>
          {[0, 1].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-surface-container-high" />
          ))}
        </>
      ) : (
        <>
          {accountsWithBalances
            .filter(({ account }) => !account.is_hidden || showHiddenAccounts)
            .map(({ account, balance, spaces }) => (
              <div key={account.id} className={`h-full ${account.is_hidden ? 'opacity-50' : ''}`}>
                <AccountCard
                  account={account}
                  balance={balance}
                  spaces={spaces}
                  transactions={transactions}
                  onTogglePin={togglePin}
                  onToggleHidden={toggleHidden}
                  isSpaceHidden={(spaceExternalId) => isSpaceHidden(account.id, spaceExternalId)}
                  onToggleSpaceHidden={(spaceExternalId) => toggleSpaceHidden(account.id, spaceExternalId)}
                />
              </div>
            ))}

          {hiddenAccountsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHiddenAccounts((v) => !v)}
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant text-xs font-medium text-on-surface-variant transition-colors hover:border-secondary-container hover:text-secondary-container"
            >
              <EyeOff className="h-4 w-4" />
              {hiddenAccountsCount} hidden account{hiddenAccountsCount === 1 ? '' : 's'} ·{' '}
              {showHiddenAccounts ? 'hide' : 'show'}
            </button>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setAddAccountOpen(true)}
        className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant text-sm font-medium text-on-surface-variant transition-colors hover:border-secondary-container hover:text-secondary-container"
      >
        <Plus className="h-5 w-5" />
        Add account
      </button>

      <Link
        href="/money/import"
        className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant text-sm font-medium text-on-surface-variant transition-colors hover:border-secondary-container hover:text-secondary-container"
      >
        <FileUp className="h-5 w-5" />
        Import PDF statement
      </Link>

      <SpendingBreakdownChart transactions={transactions} />
      <TransactionsList
        transactions={displayTransactions}
        loading={transactionsLoading}
        onChange={refreshTransactions}
        accounts={accounts}
        className="sm:col-span-2 xl:col-span-4"
      />

      <AccountFormModal
        isOpen={addAccountOpen}
        heading="New account"
        onClose={() => setAddAccountOpen(false)}
        onSave={async (values: AccountFormValues) => {
          await createManualAccount(values)
          setAddAccountOpen(false)
        }}
      />
    </>
  )
}
