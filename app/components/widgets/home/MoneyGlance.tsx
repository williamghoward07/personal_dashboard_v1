'use client'

import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import HomeSectionCard from './HomeSectionCard'

interface Part {
  status: 'loading' | 'ready' | 'unavailable'
  value: number
  currency: string
}

const IDLE: Part = { status: 'loading', value: 0, currency: 'GBP' }

export default function MoneyGlance() {
  const [cash, setCash] = useState<Part>(IDLE)
  const [investments, setInvestments] = useState<Part>(IDLE)

  useEffect(() => {
    fetch('/api/starling/balance')
      .then(async (res) => {
        if (!res.ok) return setCash({ status: 'unavailable', value: 0, currency: 'GBP' })
        const data = await res.json()
        setCash({ status: 'ready', value: data.minorUnits / 100, currency: data.currency })
      })
      .catch(() => setCash({ status: 'unavailable', value: 0, currency: 'GBP' }))

    fetch('/api/trading212/snapshot')
      .then(async (res) => {
        if (!res.ok) return setInvestments({ status: 'unavailable', value: 0, currency: 'GBP' })
        const data = await res.json()
        setInvestments({ status: 'ready', value: data.cash.total, currency: data.primaryCurrency })
      })
      .catch(() => setInvestments({ status: 'unavailable', value: 0, currency: 'GBP' }))
  }, [])

  const loading = cash.status === 'loading' && investments.status === 'loading'
  const bothUnavailable = cash.status === 'unavailable' && investments.status === 'unavailable'
  const currencyMismatch =
    cash.status === 'ready' && investments.status === 'ready' && cash.currency !== investments.currency

  const total = (cash.status === 'ready' ? cash.value : 0) + (investments.status === 'ready' ? investments.value : 0)
  const currency = cash.status === 'ready' ? cash.currency : investments.currency

  return (
    <HomeSectionCard href="/money" title="Money" icon={<DollarSign className="h-4 w-4" />} accent="blue">
      {loading ? (
        <p>Loading...</p>
      ) : bothUnavailable ? (
        <p className="text-xs text-on-surface-variant">Balances unavailable</p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="font-display text-xl font-semibold text-on-surface">
            {currency === 'GBP' ? '£' : `${currency} `}
            {total.toFixed(2)}
          </span>
          <span className="text-xs text-on-surface-variant">total assets — cash + investments</span>
          {currencyMismatch && (
            <span className="text-xs text-on-surface-variant">
              Trading 212 balance in {investments.currency}, not converted
            </span>
          )}
          {(cash.status === 'unavailable' || investments.status === 'unavailable') && !bothUnavailable && (
            <span className="text-xs text-on-surface-variant">
              {cash.status === 'unavailable' ? 'Starling' : 'Trading 212'} not connected — showing partial total
            </span>
          )}
        </div>
      )}
    </HomeSectionCard>
  )
}
