import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import HabitHeatmap from './HabitHeatmap'

export default function HabitCard({
  name,
  description,
  icon: Icon,
  color,
  seed,
  fillRate,
  doneToday,
}: {
  name: string
  description: string
  icon: LucideIcon
  color: string
  seed: number
  fillRate: number
  doneToday: boolean
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-4"
      style={{
        backgroundColor: '#141a2e',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}26`, color }}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-sm font-semibold text-white">{name}</h3>
          <p className="truncate text-xs text-white/40">{description}</p>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: doneToday ? color : 'rgba(255,255,255,0.06)',
            color: doneToday ? '#0b0f1a' : 'rgba(255,255,255,0.3)',
          }}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </div>
      </div>

      <HabitHeatmap seed={seed} fillRate={fillRate} color={color} />
    </div>
  )
}
