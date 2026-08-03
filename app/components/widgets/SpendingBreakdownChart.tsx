import type { CSSProperties } from 'react'
import WidgetCard from '../WidgetCard'

const CATEGORIES = [
  { label: 'Rent', value: 650, light: '#2a78d6', dark: '#3987e5' },
  { label: 'Food', value: 300, light: '#eb6834', dark: '#d95926' },
  { label: 'Transport', value: 100, light: '#1baf7a', dark: '#199e70' },
  { label: 'Other', value: 150, light: '#898781', dark: '#898781' },
] as const

const SIZE = 160
const RADIUS = 60
const STROKE = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

const total = CATEGORIES.reduce((sum, c) => sum + c.value, 0)

function segmentStyle(light: string, dark: string): CSSProperties {
  return { '--seg-light': light, '--seg-dark': dark } as CSSProperties
}

export default function SpendingBreakdownChart() {
  let cumulative = 0

  return (
    <WidgetCard title="Monthly spending breakdown" className="sm:col-span-2">
      <div className="flex flex-wrap items-center gap-6">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
        >
          {CATEGORIES.map((category) => {
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
                  {category.label}: £{category.value}
                </title>
              </circle>
            )
          })}
        </svg>

        <ul className="flex flex-col gap-2 text-xs">
          {CATEGORIES.map((category) => (
            <li key={category.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--seg-light) dark:bg-(--seg-dark)"
                style={segmentStyle(category.light, category.dark)}
              />
              <span className="text-black/60 dark:text-white/60">
                {category.label}
              </span>
              <span className="text-black/30 dark:text-white/30">
                £{category.value} · {Math.round((category.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetCard>
  )
}
