import WidgetCard from '../WidgetCard'
import type { Transaction } from '@/lib/types'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function NetBalanceCard({ transactions }: { transactions: Transaction[] }) {
  const monthKey = currentMonthKey()
  const net = transactions
    .filter((t) => t.date.startsWith(monthKey))
    .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

  const isPositive = net >= 0
  const formatted = `${isPositive ? '+' : '-'}£${Math.abs(net).toFixed(2)}`

  return (
    <WidgetCard title="Net balance change">
      <div className="flex flex-col gap-1">
        <span
          className={`text-2xl font-semibold ${
            isPositive
              ? 'text-[#006300] dark:text-[#0ca30c]'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {formatted}
        </span>
        <span className="text-xs text-black/30 dark:text-white/30">this month</span>
      </div>
    </WidgetCard>
  )
}
