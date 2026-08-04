'use client'

import { Check, Pencil, Trash2 } from 'lucide-react'
import HabitHeatmap, { type HabitDayStatus } from './HabitHeatmap'
import type { Habit } from '@/lib/types'

export default function HabitCard({
  habit,
  statusByDate,
  todayValue,
  onToggleToday,
  onLogToday,
  onEdit,
  onDelete,
}: {
  habit: Habit
  statusByDate: Map<string, HabitDayStatus>
  todayValue: number | null
  onToggleToday: () => void
  onLogToday: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const frequencyLabel =
    habit.frequency_type === 'daily' ? 'Daily' : `${habit.frequency_count}x / week`

  const metToday =
    habit.is_quantifiable && habit.target_value != null
      ? todayValue != null && todayValue >= habit.target_value
      : (statusByDate.get(new Date().toISOString().slice(0, 10)) ?? null) === 'met'

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-4 transition-all hover:border-habit-purple/40 hover:shadow-[0_0_15px_rgba(192,132,252,0.15)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${habit.color}26` }}
        >
          {habit.icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-on-surface">{habit.name}</h3>
            <span className="shrink-0 rounded-full bg-surface-container-highest px-1.5 py-0.5 text-[10px] text-on-surface-variant">
              {frequencyLabel}
            </span>
          </div>
          {habit.description && (
            <p className="truncate text-xs text-on-surface-variant">{habit.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${habit.name}`}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${habit.name}`}
            className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {habit.is_quantifiable ? (
            <button
              type="button"
              onClick={onLogToday}
              title={
                habit.target_value != null
                  ? `${todayValue ?? 0} / ${habit.target_value} ${habit.unit ?? ''}`
                  : `${todayValue ?? 0} ${habit.unit ?? ''}`
              }
              aria-label={`Log today's ${habit.name}`}
              className="flex h-8 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold"
              style={{
                backgroundColor: metToday ? habit.color : 'rgba(218,229,218,0.08)',
                color: metToday ? '#07100a' : 'rgba(218,229,218,0.6)',
              }}
            >
              {todayValue ?? 0}
              {habit.target_value != null ? `/${habit.target_value}` : ''}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleToday}
              aria-label={
                metToday ? `Mark ${habit.name} not done today` : `Mark ${habit.name} done today`
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: metToday ? habit.color : 'rgba(218,229,218,0.08)',
                color: metToday ? '#07100a' : 'rgba(218,229,218,0.3)',
              }}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      <HabitHeatmap statusByDate={statusByDate} color={habit.color} />
    </div>
  )
}
