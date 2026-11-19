'use client'

import LoadingSkeleton from '@/app/components/LoadingSkeleton'
import { DollarSign } from 'lucide-react'
import HomeSectionCard from './HomeSectionCard'
import { useAccounts } from '@/lib/money/use-accounts'
import { useTransactions } from '@/lib/money/use-transactions'
import { useStarlingBalances } from '@/lib/money/use-starling-balances'
import {
  resolveAccountBalance,
  computeOverallBalance,
  overallNetChangeMinorUnits,
  type MinorUnitsAndCurrency,
} from '@/lib/money/accounts'
import { minorUnitsOf } from '@/lib/money'
import type { Account, Transaction } from '@/lib/types'
import { widgetDensity, type HomeWidgetDimensions } from '@/lib/home/widget-content'
import { formatDueDay } from '../../lectures/work-format'

function formatMoney(minorUnits: number, currency: string, signed = false) {
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'GBP',
    signDisplay: signed ? 'always' : 'auto',
  })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(minorUnits / 10 ** digits)
}

function TransactionRow({ transaction, account, expanded }: {
  transaction: Transaction
  account?: Account
  expanded: boolean
}) {
  const name = transaction.merchant_name?.trim() || transaction.description?.trim() || transaction.category
  const rawAmount = transaction.raw?.amount as { currency?: string } | undefined
  const currency = rawAmount?.currency || account?.currency || 'GBP'
  const amount = (transaction.type === 'income' ? 1 : -1) * minorUnitsOf(transaction)
  const context = [formatDueDay(transaction.date), account?.name ?? transaction.account_label, expanded && transaction.category !== name ? transaction.category : null]
    .filter(Boolean).join(' · ')

  return (
    <li className="grid min-w-0 gap-x-3 gap-y-0.5 py-1.5 first:pt-0 last:pb-0 @min-[420px]/home-widget:grid-cols-[minmax(0,1fr)_auto]">
      <p className="wrap-anywhere font-medium text-on-surface">{name}</p>
      <p className={`text-xs tabular-nums @min-[420px]/home-widget:row-span-2 @min-[420px]/home-widget:text-right ${amount > 0 ? 'text-primary' : 'text-on-surface'}`}>
        {formatMoney(amount, currency, true)}
      </p>
      <p className="wrap-anywhere text-xs text-on-surface-variant">{context}</p>
    </li>
  )
}

export default function MoneyGlance(dimensions: HomeWidgetDimensions) {
  const { accounts, loading: accountsLoading } = useAccounts()
  const { transactions, loading: transactionsLoading } = useTransactions()
  const { state: starlingState } = useStarlingBalances()
  const density = widgetDensity(dimensions)

  const starlingBalances =
    starlingState.status === 'ready'
      ? starlingState.balances
      : starlingState.status === 'loading'
        ? 'loading'
        : 'unavailable'

  const byId = new Map(accounts.map((account) => [account.id, account]))
  const totalsByCurrency = new Map<string, { accounts: Account[]; balances: MinorUnitsAndCurrency[] }>()
  let pending = false
  let unavailable = false
  for (const account of accounts) {
    const balance = resolveAccountBalance(account, transactions, starlingBalances)
    pending ||= balance === 'loading'
    unavailable ||= balance === 'unavailable'
    const currency = typeof balance === 'object' ? balance.currency : account.currency
    const group = totalsByCurrency.get(currency) ?? { accounts: [], balances: [] }
    group.accounts.push(account)
    if (typeof balance === 'object') group.balances.push(balance)
    totalsByCurrency.set(currency, group)
  }

  const recent = transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .slice(0, [2, 5, 9][density])

  return (
    <HomeSectionCard href="/money" title="Money" icon={<DollarSign className="h-4 w-4" />} accent="blue">
      {accountsLoading || transactionsLoading ? (
        <LoadingSkeleton shape="metric" label="Loading money…" />
      ) : (
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <p>No accounts yet.</p>
          ) : (
            <div className="space-y-2">
              {[...totalsByCurrency].map(([currency, group]) => {
                const overall = computeOverallBalance(group.balances)
                const change = overallNetChangeMinorUnits(group.accounts, transactions, 'month')
                const accountCount = group.accounts.length
                return (
                  <div key={currency} className="flex min-w-0 flex-col gap-0.5">
                    {group.balances.length > 0 && (
                      <span className="wrap-anywhere font-display text-xl font-semibold tabular-nums text-on-surface">
                        {formatMoney(overall.minorUnits, currency)}
                      </span>
                    )}
                    <span className="text-xs text-on-surface-variant">
                      {formatMoney(change, currency, true)} over 30 days · {accountCount} account{accountCount === 1 ? '' : 's'}
                    </span>
                  </div>
                )
              })}
              {pending && <p className="text-xs">Loading live balances…</p>}
              {unavailable && <p className="text-xs">Some balances are unavailable.</p>}
            </div>
          )}

          <section className="border-t border-outline-variant/50 pt-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Recent transactions</h3>
            {recent.length === 0 ? <p className="text-xs">No transactions yet.</p> : (
              <ul className="divide-y divide-outline-variant/50">
                {recent.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    account={transaction.account_id ? byId.get(transaction.account_id) : undefined}
                    expanded={density > 0}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </HomeSectionCard>
  )
}
