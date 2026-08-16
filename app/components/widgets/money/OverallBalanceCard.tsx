'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import LiquidSwitch from '../../LiquidSwitch'
import type { Account, Transaction } from '@/lib/types'
import { formatPounds, formatRelativeTime, CHANGE_PERIOD_OPTIONS, type ChangePeriod } from '@/lib/money'
import {
  computeOverallBalance,
  hasMixedCurrencies,
  overallNetChangeMinorUnits,
  type AccountBalanceState,
} from '@/lib/money/accounts'

export default function OverallBalanceCard({
  accountsWithBalances,
  accounts,
  transactions,
  onSync,
  syncing,
  syncError,
  lastSyncedAt,
}: {
  accountsWithBalances: { account: Account; balance: AccountBalanceState }[]
  accounts: Account[]
  transactions: Transaction[]
  onSync: () => void
  syncing: boolean
  syncError: string | null
  lastSyncedAt: string | null
}) {
  const [period, setPeriod] = useState<ChangePeriod>('month')

  const resolved = accountsWithBalances
    .filter((x) => typeof x.balance === 'object')
    .map((x) => x.balance as { minorUnits: number; currency: string })
  const anyPending = accountsWithBalances.some((x) => x.balance === 'loading')
  const anyUnavailable = accountsWithBalances.some((x) => x.balance === 'unavailable')

  const overall = computeOverallBalance(resolved)
  const mixedCurrencies = hasMixedCurrencies(resolved)
  const changeMinorUnits = overallNetChangeMinorUnits(accounts, transactions, period)
  const isPositive = changeMinorUnits >= 0

  return (
    <ModuleGlassCard accent="blue" className="flex flex-col gap-4 sm:col-span-2 xl:col-span-4">
      <GlassCardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-foreground">Overall balance</h2>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            aria-label="Sync Starling transactions"
            className="flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-3xl font-semibold text-on-surface">
              {formatPounds(overall.minorUnits)}
            </span>
            <span className="text-xs text-on-surface-variant">
              across {accounts.length} account{accounts.length === 1 ? '' : 's'}
              {anyPending ? ' · some balances still loading' : ''}
              {anyUnavailable ? ' · some balances unavailable' : ''}
            </span>
            {mixedCurrencies && (
              <span className="text-xs text-on-surface-variant">
                Accounts use more than one currency — this total isn&apos;t converted.
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
        </div>

        <div className="flex items-center gap-2 border-t border-outline-variant/50 pt-3 text-xs text-on-surface-variant">
          <span>Starling synced {formatRelativeTime(lastSyncedAt)}</span>
          {syncError && <span className="text-error">{syncError}</span>}
        </div>
      </GlassCardContent>
    </ModuleGlassCard>
  )
}
