import { Check } from 'lucide-react'
import { ACCENT_BAR } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { PREP_ACCENT } from '@/lib/timetable/format'
import { PREP_LABEL, type PrepStatus } from '@/lib/timetable/session'

/**
 * A session's prep traffic light, with a small tick beside it once notes
 * are taken. The label is in the title/sr text, so colour is never the
 * only signal.
 */
export default function PrepLight({
  status,
  notesDone = false,
  size = 'md',
  className,
}: {
  status: PrepStatus
  notesDone?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const label = `${PREP_LABEL[status]}${notesDone ? ' · notes taken' : ''}`
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5', className)} title={label}>
      <span
        className={cn('rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5', ACCENT_BAR[PREP_ACCENT[status]])}
        aria-hidden
      />
      {notesDone && (
        <Check className={cn('text-on-surface-variant', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} strokeWidth={2.5} aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
