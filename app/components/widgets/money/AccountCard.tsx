'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Landmark, Pin } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import LiquidSwitch from '../../LiquidSwitch'
import type { Account, Transaction } from '@/lib/types'
import { formatPounds, CHANGE_PERIOD_OPTIONS, type ChangePeriod } from '@/lib/money'
import { accountNetChangeMinorUnits, type AccountBalanceState } from '@/lib/money/accounts'

export default function AccountCard({
  account,
  balance,
  transactions,
  onTogglePin,
}: {
  account: Account
  balance: AccountBalanceState
  transactions: Transaction[]
  onTogglePin: (id: string) => void
}) {
  const [period, setPeriod] = useState<ChangePeriod>('month')
  const changeMinorUnits = accountNetChangeMinorUnits(account, transactions, period)
  const isPositive = changeMinorUnits >= 0

  return (
    <Link href={`/money/accounts/${account.id}`} className="group block h-full">
      <ModuleGlassCard
        accent="blue"
        className="flex h-full flex-col gap-4 transition-transform duration-200 group-hover:-translate-y-0.5"
      >
        <GlassCardHeader>
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-2 font-display text-sm font-semibold text-foreground">
              <Landmark className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
              <span className="truncate">{account.name}</span>
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onTogglePin(account.id)
              }}
              aria-label={account.is_pinned ? `Unpin ${account.name}` : `Pin ${account.name}`}
              aria-pressed={account.is_pinned}
              className={`shrink-0 rounded-md p-1 transition-colors ${
                account.is_pinned ? 'text-secondary-container' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Pin className={`h-3.5 w-3.5 ${account.is_pinned ? 'fill-current' : ''}`} />
            </button>
          </div>
          <span className="text-xs capitalize text-on-surface-variant">
            {account.source === 'starling' ? 'Starling' : 'Manual'}
          </span>
        </GlassCardHeader>

        <GlassCardContent className="flex flex-1 flex-col gap-4">
          {balance === 'loading' ? (
            <div className="h-8 w-24 animate-pulse rounded bg-surface-container-high" />
          ) : balance === 'unavailable' ? (
            <p className="text-xs text-on-surface-variant">Balance unavailable</p>
          ) : (
            <span className="font-display text-2xl font-semibold text-on-surface">
              {formatPounds(balance.minorUnits)}
            </span>
          )}

          <div
            className="mt-auto flex flex-col gap-2 border-t border-outline-variant/50 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
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
        </GlassCardContent>
      </ModuleGlassCard>
    </Link>
  )
}
