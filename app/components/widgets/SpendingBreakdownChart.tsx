import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import type { Transaction } from '@/lib/types'
import { minorUnitsOf } from '@/lib/money'

const PALETTE = ['#3987e5', '#d95926', '#199e70']
const OTHER = '#849587'

const SIZE = 160
const RADIUS = 60
const STROKE = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

  // All values from here on are minor units (pence) — converted to pounds
  // only where rendered as text below.
  const byCategory = new Map<string, number>()
  for (const t of outgoing) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + minorUnitsOf(t))
  }
  const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 3)
  const otherTotal = sorted.slice(3).reduce((sum, [, v]) => sum + v, 0)

  const categories = [
    ...top.map(([label, value], i) => ({ label, value, color: PALETTE[i] })),
    ...(otherTotal > 0 ? [{ label: 'Other', value: otherTotal, color: OTHER }] : []),
  ]

  const total = categories.reduce((sum, c) => sum + c.value, 0)
  let cumulative = 0

  return (
    <ModuleGlassCard accent="blue" className="flex flex-col gap-3 sm:col-span-2">
      <GlassCardHeader>
        <h2 className="font-display text-sm font-semibold text-foreground">Monthly spending breakdown</h2>
      </GlassCardHeader>
      <GlassCardContent>
      {total === 0 ? (
        <p className="text-sm text-on-surface-variant">No spending logged yet this month.</p>
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
                  stroke={category.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(rawLength - GAP, 0)} ${CIRCUMFERENCE - rawLength + GAP}`}
                  strokeDashoffset={-offset}
                >
                  <title>
                    {category.label}: £{(category.value / 100).toFixed(2)}
                  </title>
                </circle>
              )
            })}
          </svg>

          <ul className="flex flex-col gap-2 text-xs">
            {categories.map((category) => (
              <li key={category.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-on-surface">{category.label}</span>
                <span className="text-on-surface-variant">
                  £{(category.value / 100).toFixed(2)} ·{' '}
                  {Math.round((category.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      </GlassCardContent>
    </ModuleGlassCard>
  )
}
