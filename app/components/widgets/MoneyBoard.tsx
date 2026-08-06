'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { isSuccessfulTransaction } from '@/lib/money'
import NetBalanceCard from './NetBalanceCard'
import StarlingBalanceCard from './StarlingBalanceCard'
import SpendingBreakdownChart from './SpendingBreakdownChart'
import TransactionsList from './transactions/TransactionsList'

export default function MoneyBoard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const refresh = () => {
    Promise.all([
      supabase.from('transactions').select('*'),
      supabase
        .from('integrations')
        .select('last_synced_at')
        .eq('provider', 'starling')
        .maybeSingle(),
    ]).then(([txRes, integrationRes]) => {
      setTransactions((txRes.data ?? []).filter(isSuccessfulTransaction))
      setLastSyncedAt(integrationRes.data?.last_synced_at ?? null)
      setLoading(false)
    })
  }

  useEffect(refresh, [])

  const syncNow = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/starling/sync', { method: 'POST' })
      if (!res.ok) {
        setSyncError('Sync failed')
      } else {
        refresh()
      }
    } catch {
      setSyncError('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <StarlingBalanceCard transactions={transactions} />
      <NetBalanceCard
        transactions={transactions}
        lastSyncedAt={lastSyncedAt}
        syncing={syncing}
        syncError={syncError}
        onSync={syncNow}
      />
      <SpendingBreakdownChart transactions={transactions} />
      <TransactionsList transactions={transactions} loading={loading} onChange={refresh} />
    </>
  )
}
