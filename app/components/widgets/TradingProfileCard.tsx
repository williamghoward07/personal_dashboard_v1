'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import WidgetCard from '../WidgetCard'

interface Trading212Position {
  ticker: string
  quantity: number
  averagePrice: number
  currentPrice: number
  ppl: number
  currencyCode: string | null
  isForeignCurrency: boolean
}

interface Trading212Snapshot {
  primaryCurrency: string
  cash: { free: number; invested: number; blocked: number; total: number }
  positions: Trading212Position[]
}

type SnapshotState =
  | { status: 'loading' }
  | { status: 'ready'; data: Trading212Snapshot }
  | { status: 'not_connected' }
  | { status: 'error' }

function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? '-' : ''
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`
}

export default function TradingProfileCard() {
  const [state, setState] = useState<SnapshotState>({ status: 'loading' })

  useEffect(() => {
    fetch('/api/trading212/snapshot')
      .then(async (res) => {
        if (res.status === 503) return setState({ status: 'not_connected' })
        if (!res.ok) return setState({ status: 'error' })
        const data = await res.json()
        setState({ status: 'ready', data })
      })
      .catch(() => setState({ status: 'error' }))
  }, [])

  return (
    <WidgetCard title="Trading 212" icon={<TrendingUp className="h-4 w-4" />} accent="blue">
      {state.status === 'loading' && <p>Loading...</p>}
      {state.status === 'not_connected' && (
        <p className="text-xs text-on-surface-variant">Trading 212 not connected</p>
      )}
      {state.status === 'error' && <p className="text-xs text-error">Trading 212 unavailable</p>}
      {state.status === 'ready' && (
        <Trading212Body data={state.data} />
      )}
    </WidgetCard>
  )
}

function Trading212Body({ data }: { data: Trading212Snapshot }) {
  const { cash, positions, primaryCurrency } = data
  const hasForeignCurrencyPositions = positions.some((p) => p.isForeignCurrency)

  return (
    <div className="flex flex-col gap-4">
      <span className="font-display text-2xl font-semibold text-on-surface">
        {formatMoney(cash.total, primaryCurrency)}
      </span>

      <div className="flex gap-4 text-xs">
        <div className="flex flex-col">
          <span className="text-on-surface-variant">Free</span>
          <span className="font-medium text-on-surface">{formatMoney(cash.free, primaryCurrency)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-on-surface-variant">Invested</span>
          <span className="font-medium text-on-surface">{formatMoney(cash.invested, primaryCurrency)}</span>
        </div>
      </div>

      {positions.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-outline-variant/50 pt-3">
          {positions.map((p) => {
            const isPositive = p.ppl >= 0
            return (
              <li key={p.ticker} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-on-surface">{p.ticker}</span>
                <span className={isPositive ? 'text-primary-container' : 'text-error'}>
                  {isPositive ? '+' : ''}
                  {formatMoney(p.ppl, p.currencyCode ?? primaryCurrency)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {hasForeignCurrencyPositions && (
        <p className="text-xs text-on-surface-variant">
          Some positions are held in a currency other than {primaryCurrency} — those totals aren&apos;t
          converted.
        </p>
      )}
    </div>
  )
}
