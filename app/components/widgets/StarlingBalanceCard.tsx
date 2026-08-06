'use client'

import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import WidgetCard from '../WidgetCard'
import LiquidSwitch from '../LiquidSwitch'
import type { Transaction } from '@/lib/types'
import { formatPounds, netChangeMinorUnits, CHANGE_PERIOD_OPTIONS, type ChangePeriod } from '@/lib/money'

type BalanceState =
  | { status: 'loading' }
  | { status: 'ready'; minorUnits: number; currency: string }
  | { status: 'not_connected' }
  | { status: 'error' }

export default function StarlingBalanceCard({ transactions }: { transactions: Transaction[] }) {
  const [balance, setBalance] = useState<BalanceState>({ status: 'loading' })
  const [period, setPeriod] = useState<ChangePeriod>('month')

  useEffect(() => {
    fetch('/api/starling/balance')
      .then(async (res) => {
        if (res.status === 503) return setBalance({ status: 'not_connected' })
        if (!res.ok) return setBalance({ status: 'error' })
        const data = await res.json()
        setBalance({ status: 'ready', minorUnits: data.minorUnits, currency: data.currency })
      })
      .catch(() => setBalance({ status: 'error' }))
  }, [])

  const changeMinorUnits = netChangeMinorUnits(transactions, period, 'starling')
  const isPositive = changeMinorUnits >= 0

  return (
    <WidgetCard title="Starling Balance" icon={<Landmark className="h-4 w-4" />} accent="blue">
      <div className="flex flex-col gap-4">
        {balance.status === 'loading' && <p>Loading...</p>}
        {balance.status === 'not_connected' && (
          <p className="text-xs text-on-surface-variant">Starling not connected</p>
        )}
        {balance.status === 'error' && <p className="text-xs text-error">Starling unavailable</p>}
        {balance.status === 'ready' && (
          <span className="font-display text-2xl font-semibold text-on-surface">
            {formatPounds(balance.minorUnits)}
          </span>
        )}

        <div className="flex flex-col gap-2 border-t border-outline-variant/50 pt-3">
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
    </WidgetCard>
  )
}
