'use client'

import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import HomeSectionCard from './HomeSectionCard'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MoneyGlance() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('transactions')
      .select('*')
      .then(({ data }) => {
        setTransactions(data ?? [])
        setLoading(false)
      })
  }, [])

  const monthKey = currentMonthKey()
  const net = transactions
    .filter((t) => t.date.startsWith(monthKey))
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)
  const isPositive = net >= 0

  return (
    <HomeSectionCard href="/money" title="Money" icon={<DollarSign className="h-4 w-4" />} accent="blue">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex flex-col gap-1">
          <span
            className={`font-display text-xl font-semibold ${
              isPositive ? 'text-primary-container' : 'text-error'
            }`}
          >
            {isPositive ? '+' : '-'}£{Math.abs(net).toFixed(2)}
          </span>
          <span className="text-xs text-on-surface-variant">this month</span>
        </div>
      )}
    </HomeSectionCard>
  )
}
