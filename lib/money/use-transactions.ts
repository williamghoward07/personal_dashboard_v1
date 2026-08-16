'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import { isSuccessfulTransaction } from '@/lib/money'

// Shared between the main Money page (accountId omitted — every
// transaction) and an account's detail page (accountId set — just that
// account's own). Read-only: individual add/edit/delete happens directly
// in TransactionsList, which calls `refresh` afterward.
export function useTransactions(accountId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    let query = supabase.from('transactions').select('*')
    if (accountId) query = query.eq('account_id', accountId)

    query.then(({ data }) => {
      setTransactions(((data ?? []) as Transaction[]).filter(isSuccessfulTransaction))
      setLoading(false)
    })
  }, [accountId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { transactions, loading, refresh }
}
