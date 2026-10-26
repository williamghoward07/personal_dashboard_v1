import { ACCENT_BAR } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { POST_ACCENT, PREP_ACCENT } from '@/lib/timetable/format'
import { POST_LABEL, PREP_LABEL, type PostStatus, type PrepStatus } from '@/lib/timetable/session'

/**
 * A session's traffic light, split in two: prep before the session on the
 * left, follow-up after it on the right (neutral until it's due). The
 * labels are in the title/sr text, so colour is never the only signal.
 */
export default function PrepLight({
  status,
  postStatus,
  size = 'md',
  className,
}: {
  status: PrepStatus
  postStatus: PostStatus
  size?: 'sm' | 'md'
  className?: string
}) {
  const label = `Before: ${PREP_LABEL[status]} · After: ${POST_LABEL[postStatus]}`
  const half = cn(size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5')
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-px', className)} title={label}>
      <span className={cn(half, 'rounded-l-full', ACCENT_BAR[PREP_ACCENT[status]])} aria-hidden />
      <span className={cn(half, 'rounded-r-full', ACCENT_BAR[POST_ACCENT[postStatus]])} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}
