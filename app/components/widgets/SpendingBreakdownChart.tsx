import type { CSSProperties } from 'react'
import WidgetCard from '../WidgetCard'
import type { Transaction } from '@/lib/types'

const PALETTE = [
  { light: '#2a78d6', dark: '#3987e5' }, // blue
  { light: '#eb6834', dark: '#d95926' }, // orange
  { light: '#1baf7a', dark: '#199e70' }, // aqua
]
const OTHER = { light: '#898781', dark: '#898781' }

const SIZE = 160
const RADIUS = 60
const STROKE = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function segmentStyle(light: string, dark: string): CSSProperties {
  return { '--seg-light': light, '--seg-dark': dark } as CSSProperties
}

export default function SpendingBreakdownChart({
  transactions,
}: {
  transactions: Transaction[]
}) {
  const monthKey = currentMonthKey()
  const outgoing = transactions.filter(
    (t) => t.type === 'outgoing' && t.date.startsWith(monthKey),
  )

  const byCategory = new Map<string, number>()
  for (const t of outgoing) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }
  const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 3)
  const otherTotal = sorted.slice(3).reduce((sum, [, v]) => sum + v, 0)

  const categories = [
    ...top.map(([label, value], i) => ({ label, value, ...PALETTE[i] })),
    ...(otherTotal > 0 ? [{ label: 'Other', value: otherTotal, ...OTHER }] : []),
  ]

  const total = categories.reduce((sum, c) => sum + c.value, 0)
  let cumulative = 0

  return (
    <WidgetCard title="Monthly spending breakdown" className="sm:col-span-2">
      {total === 0 ? (
        <p>No spending logged yet this month.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="-rotate-90"
          >
            {categories.map((category) => {
              const fraction = category.value / total
              const rawLength = fraction * CIRCUMFERENCE
              const offset = cumulative
              cumulative += rawLength

              return (
                <circle
                  key={category.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(rawLength - GAP, 0)} ${CIRCUMFERENCE - rawLength + GAP}`}
                  strokeDashoffset={-offset}
                  className="stroke-(--seg-light) dark:stroke-(--seg-dark)"
                  style={segmentStyle(category.light, category.dark)}
                >
                  <title>
                    {category.label}: £{category.value.toFixed(2)}
                  </title>
                </circle>
              )
            })}
          </svg>

          <ul className="flex flex-col gap-2 text-xs">
            {categories.map((category) => (
              <li key={category.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--seg-light) dark:bg-(--seg-dark)"
                  style={segmentStyle(category.light, category.dark)}
                />
                <span className="text-black/60 dark:text-white/60">
                  {category.label}
                </span>
                <span className="text-black/30 dark:text-white/30">
                  £{category.value.toFixed(2)} ·{' '}
                  {Math.round((category.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  )
}
