'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { iconButtonClass, wsAccentStyle } from './shared'

/** The chevron in a workspace section's header that collapses it to a bar. */
export function CollapseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Collapse ${label}`} title="Collapse" className={iconButtonClass}>
      <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
    </button>
  )
}

/** A collapsed section: one slim row with its name, a count/summary, and expand. */
export function CollapsedSectionBar({
  label,
  Icon,
  summary,
  onExpand,
  actions,
}: {
  label: string
  Icon: LucideIcon
  summary: ReactNode
  onExpand: () => void
  actions?: ReactNode
}) {
  return (
    <ModuleGlassCard style={wsAccentStyle} size="sm" className="flex items-center gap-2 py-2">
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={false}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icon className="h-4 w-4 shrink-0 text-ws-accent" strokeWidth={1.75} />
        <span className="shrink-0 font-display text-sm font-semibold text-on-surface">{label}</span>
        <span className="truncate text-xs text-on-surface-variant">{summary}</span>
      </button>
      {actions}
      <button type="button" onClick={onExpand} aria-label={`Expand ${label}`} title="Expand" className={iconButtonClass}>
        <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </ModuleGlassCard>
  )
}
