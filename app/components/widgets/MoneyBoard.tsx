'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileUp, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAccounts } from '@/lib/money/use-accounts'
import { useTransactions } from '@/lib/money/use-transactions'
import { useStarlingBalances } from '@/lib/money/use-starling-balances'
import { resolveAccountBalance, sortAccounts } from '@/lib/money/accounts'
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
    refresh: refreshAccounts,
  } = useAccounts()
  const { transactions, loading: transactionsLoading, refresh: refreshTransactions } = useTransactions()
  const { state: starlingState, refresh: refreshStarlingBalances } = useStarlingBalances()

  const [addAccountOpen, setAddAccountOpen] = useState(false)
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
        accountsWithBalances.map(({ account, balance }) => (
          <AccountCard
            key={account.id}
            account={account}
            balance={balance}
            transactions={transactions}
            onTogglePin={togglePin}
          />
        ))
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
        transactions={transactions}
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
