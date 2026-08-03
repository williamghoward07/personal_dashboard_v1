import type { ReactNode } from 'react'
import type { Accent } from '@/lib/theme'
import { ACCENT_GLOW, ACCENT_TEXT } from '@/lib/theme'

export default function WidgetCard({
  title,
  icon,
  action,
  accent = 'neutral',
  className = '',
  children,
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  accent?: Accent
  className?: string
  children?: ReactNode
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-outline-variant bg-linear-to-br from-surface-container-low to-surface-container-lowest p-5 transition-all duration-200 ${ACCENT_GLOW[accent]} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          {icon && <span className={ACCENT_TEXT[accent]}>{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      <div className="flex-1 text-sm text-on-surface-variant">
        {children ?? 'Coming soon'}
      </div>
    </section>
  )
}
