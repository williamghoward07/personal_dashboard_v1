'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { isSuccessfulTransaction, isFailedOrZeroTransaction } from '@/lib/money'

// Shared between the main Money page (accountId omitted — every
// transaction) and an account's detail page (accountId set — just that
// account's own). Read-only: individual add/edit/delete happens directly
// in TransactionsList, which calls `refresh` afterward.
//
// Two views over the same fetch: `transactions` (successful only — what
// balance/net-change/spending math must use) and `displayTransactions`
// (also includes failed/declined/zero-value rows, for the transactions
// list UI to surface rather than hide).
export function useTransactions(accountId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [displayTransactions, setDisplayTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    let query = supabase.from('transactions').select('*')
    if (accountId) query = query.eq('account_id', accountId)

    query.then(({ data }) => {
      const all = (data ?? []) as Transaction[]
      setTransactions(all.filter(isSuccessfulTransaction))
      setDisplayTransactions(all.filter((t) => isSuccessfulTransaction(t) || isFailedOrZeroTransaction(t)))
      setLoading(false)
    })
  }, [accountId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { transactions, displayTransactions, loading, refresh }
}
