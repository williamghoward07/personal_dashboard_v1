'use client'

import { DollarSign } from 'lucide-react'
import HomeSectionCard from './HomeSectionCard'
import { useAccounts } from '@/lib/money/use-accounts'
import { useTransactions } from '@/lib/money/use-transactions'
import { useStarlingBalances } from '@/lib/money/use-starling-balances'
import {
  resolveAccountBalance,
  computeOverallBalance,
  hasMixedCurrencies,
  overallNetChangeMinorUnits,
} from '@/lib/money/accounts'
import { formatPounds } from '@/lib/money'

export default function MoneyGlance() {
  const { accounts, loading: accountsLoading } = useAccounts()
  const { transactions, loading: transactionsLoading } = useTransactions()
  const { state: starlingState } = useStarlingBalances()

  const starlingBalances =
    starlingState.status === 'ready'
      ? starlingState.balances
      : starlingState.status === 'loading'
        ? 'loading'
        : 'unavailable'

  const resolved = accounts
    .map((account) => resolveAccountBalance(account, transactions, starlingBalances))
    .filter((b): b is { minorUnits: number; currency: string } => typeof b === 'object')

  const overall = computeOverallBalance(resolved)
  const mixedCurrencies = hasMixedCurrencies(resolved)
  const changeMinorUnits = overallNetChangeMinorUnits(accounts, transactions, 'month')
  const isPositive = changeMinorUnits >= 0
  const loading = accountsLoading || transactionsLoading

  return (
    <HomeSectionCard href="/money" title="Money" icon={<DollarSign className="h-4 w-4" />} accent="blue">
      {loading ? (
        <p>Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No accounts yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="font-display text-xl font-semibold text-on-surface">
            {formatPounds(overall.minorUnits)}
          </span>
          <span className="text-xs text-on-surface-variant">
            {isPositive ? '+' : ''}
            {formatPounds(changeMinorUnits)} this month · {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </span>
          {mixedCurrencies && (
            <span className="text-xs text-on-surface-variant">Uses more than one currency — not converted.</span>
          )}
        </div>
      )}
    </HomeSectionCard>
  )
}
