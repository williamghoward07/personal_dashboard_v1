import { cn } from '@/lib/utils/cn'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/**
 * A day column's heading: "MON 9" on one line, the date to the right of
 * the day so the header stays one short row. Today's date sits in a
 * filled circle, as in Google Calendar.
 */
export default function DayHeading({
  dateKey,
  isToday,
  onClick,
  className,
}: {
  dateKey: string
  isToday: boolean
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      <span
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wide',
          isToday ? 'text-secondary-container' : 'text-on-surface-variant'
        )}
      >
        {weekdayShort(dateKey)}
      </span>
      <span
        className={cn(
          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums',
          isToday ? 'bg-secondary-container text-on-secondary' : 'text-on-surface'
        )}
      >
        {Number(dateKey.slice(-2))}
      </span>
    </>
  )
  const base = 'flex min-w-0 items-center justify-center gap-1.5 py-1.5'
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-current={isToday ? 'date' : undefined}
      title="Open this day"
      className={cn(base, 'transition-colors duration-200 hover:bg-surface-container-high', className)}
    >
      {content}
    </button>
  ) : (
    <div aria-current={isToday ? 'date' : undefined} className={cn(base, className)}>
      {content}
    </div>
  )
}
