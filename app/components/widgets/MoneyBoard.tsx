'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import NetBalanceCard from './NetBalanceCard'
import SpendingBreakdownChart from './SpendingBreakdownChart'
import TransactionsList from './transactions/TransactionsList'

export default function MoneyBoard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    supabase
      .from('transactions')
      .select('*')
      .then(({ data }) => {
        setTransactions(data ?? [])
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  return (
    <>
      <NetBalanceCard transactions={transactions} />
      <SpendingBreakdownChart transactions={transactions} />
      <TransactionsList transactions={transactions} loading={loading} onChange={refresh} />
    </>
  )
}
