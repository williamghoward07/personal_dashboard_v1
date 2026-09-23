'use client'

import { Check, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { MetadataChip } from '@/components/ui/metadata-chip'
import HabitHeatmap, { type HabitDayStatus } from './HabitHeatmap'
import type { DailyGoalHabit } from '@/lib/types'
import { londonDayBoundsUTC } from '@/lib/google/london-day'

const DAY_ABBREV = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Europe/London calendar day, like the rest of the app.
function todayISO() {
  return londonDayBoundsUTC().startDateKey
}

function frequencyLabel(habit: DailyGoalHabit) {
  if (habit.frequency_type === 'daily') return 'Daily'
  if (habit.frequency_type === 'times_per_week') return `${habit.weekly_target}x / week`
  return (habit.days_of_week ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_ABBREV[d - 1])
    .join(', ') || 'Specific days'
}

export default function HabitCard({
  habit,
  statusByDate,
  todayValue,
  onCellClick,
  onEdit,
  onDelete,
}: {
  habit: DailyGoalHabit
  statusByDate: Map<string, HabitDayStatus>
  todayValue: number | null
  // Single entry point for "act on habit X for date Y" — the header's
  // quick-toggle/quick-log buttons and the heatmap's individual cells all
  // funnel through this one callback, which HabitBoard branches on
  // (today vs past, quantifiable vs plain) in one place rather than each
  // caller re-deriving that logic.
  onCellClick: (date: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  // Drag reordering is scoped to a small handle, not the whole card —
  // the card is already full of its own clickable buttons, and dnd-kit's
  // pointer sensor would otherwise compete with those for the same
  // pointerdown events.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
      : undefined,
    transition: transition ?? undefined,
  }

  const metToday =
    habit.is_quantifiable && habit.target_value != null
      ? todayValue != null && todayValue >= habit.target_value
      : (statusByDate.get(todayISO()) ?? null) === 'met'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-4 rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-4 transition-all hover:border-habit-purple/40 hover:shadow-[0_0_15px_rgba(192,132,252,0.15)] ${
        isDragging ? 'z-10 opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${habit.name}`}
          className="shrink-0 touch-none cursor-grab rounded p-1 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: `${habit.colour}26` }}
        >
          {habit.icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-on-surface">{habit.name}</h3>
            <MetadataChip className="shrink-0">{frequencyLabel(habit)}</MetadataChip>
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
              onClick={() => onCellClick(todayISO())}
              title={
                habit.target_value != null
                  ? `${todayValue ?? 0} / ${habit.target_value} ${habit.unit ?? ''}`
                  : `${todayValue ?? 0} ${habit.unit ?? ''}`
              }
              aria-label={`Log today's ${habit.name}`}
              className="flex h-8 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold"
              style={{
                backgroundColor: metToday
                  ? habit.colour
                  : 'color-mix(in srgb, var(--color-on-surface) 8%, transparent)',
                color: metToday
                  ? 'var(--color-surface-container-lowest)'
                  : 'color-mix(in srgb, var(--color-on-surface) 60%, transparent)',
              }}
            >
              {todayValue ?? 0}
              {habit.target_value != null ? `/${habit.target_value}` : ''}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCellClick(todayISO())}
              aria-label={
                metToday ? `Mark ${habit.name} not done today` : `Mark ${habit.name} done today`
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: metToday
                  ? habit.colour
                  : 'color-mix(in srgb, var(--color-on-surface) 8%, transparent)',
                color: metToday
                  ? 'var(--color-surface-container-lowest)'
                  : 'color-mix(in srgb, var(--color-on-surface) 30%, transparent)',
              }}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      <HabitHeatmap statusByDate={statusByDate} colour={habit.colour} onCellClick={onCellClick} />
    </div>
  )
}
