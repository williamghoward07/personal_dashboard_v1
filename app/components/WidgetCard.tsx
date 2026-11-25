import type { ReactNode } from 'react'
import type { UiAccent } from '@/lib/theme'
import { ACCENT_GLOW, ACCENT_TEXT } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'

// The bento card every home widget renders inside — DESIGN.md §4.2's
// canonical card (1px outline-variant border, rounded-xl, 24px padding) with
// the §4.3 Cyber Glow on hover in the module's own accent.
export default function WidgetCard({
  title,
  icon,
  action,
  accent = 'neutral',
  className = '',
  children,
}: {
  title: ReactNode
  icon?: ReactNode
  action?: ReactNode
  accent?: UiAccent
  className?: string
  children?: ReactNode
}) {
  return (
    <section
      data-ui="widget-card"
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-container-padding transition-all duration-300 ease-out hover:-translate-y-1',
        ACCENT_GLOW[accent],
        className
      )}
    >
      <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-sm font-semibold text-on-surface">
          {icon && (
            <span className={`shrink-0 transition-transform duration-300 group-hover:scale-[1.15] ${ACCENT_TEXT[accent]}`}>
              {icon}
            </span>
          )}
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {action && (
          <div className="flex shrink-0 items-center [@media(pointer:coarse)]:-my-3 [@media(pointer:coarse)]:[&_a]:min-h-11 [@media(pointer:coarse)]:[&_a]:min-w-11 [@media(pointer:coarse)]:[&_button]:min-h-11 [@media(pointer:coarse)]:[&_button]:min-w-11">
            {action}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 text-sm text-on-surface-variant">
        {children ?? 'Coming soon'}
      </div>
    </section>
  )
}
