import { RefreshCw } from 'lucide-react'
import WidgetCard from '../WidgetCard'
import type { Transaction } from '@/lib/types'
import { minorUnitsOf, formatPounds, formatRelativeTime } from '@/lib/money'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function NetBalanceCard({
  transactions,
  lastSyncedAt,
  syncing,
  syncError,
  onSync,
}: {
  transactions: Transaction[]
  lastSyncedAt: string | null
  syncing: boolean
  syncError: string | null
  onSync: () => void
}) {
  const monthKey = currentMonthKey()
  const netMinorUnits = transactions
    .filter((t) => t.date.startsWith(monthKey))
    .reduce((sum, t) => sum + (t.type === 'income' ? minorUnitsOf(t) : -minorUnitsOf(t)), 0)

  const isPositive = netMinorUnits >= 0
  const formatted = `${isPositive ? '+' : ''}${formatPounds(netMinorUnits)}`

  return (
    <WidgetCard
      title="Net balance change"
      accent="blue"
      action={
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          aria-label="Sync Starling transactions"
          className="flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        <span
          className={`font-display text-data-display ${
            isPositive ? 'text-primary-container' : 'text-error'
          }`}
        >
          {formatted}
        </span>
        <span className="text-xs text-on-surface-variant">this month</span>
        <span className="text-xs text-on-surface-variant">
          Starling synced {formatRelativeTime(lastSyncedAt)}
        </span>
        {syncError && <span className="text-xs text-error">{syncError}</span>}
      </div>
    </WidgetCard>
  )
}
