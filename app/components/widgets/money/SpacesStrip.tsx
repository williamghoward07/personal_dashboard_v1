'use client'

import { useState } from 'react'
import { ChevronDown, Eye, EyeOff, PiggyBank, Wallet } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { formatPounds } from '@/lib/money'
import type { StarlingSpaceBalance } from '@/lib/money/use-starling-balances'

// Shared between AccountCard (Money page, collapsed by default) and
// AccountDetailBoard (account detail page, open by default) — one place
// for the pot-tile look, the expand/collapse, and the hide toggle so
// neither call site reinvents it.
export default function SpacesStrip({
  spaces,
  isHidden,
  onToggleHidden,
  defaultExpanded = false,
}: {
  spaces: StarlingSpaceBalance[]
  isHidden: (spaceExternalId: string) => boolean
  onToggleHidden: (spaceExternalId: string) => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showHidden, setShowHidden] = useState(false)

  if (spaces.length === 0) return null

  const visible = spaces.filter((s) => !isHidden(s.externalId))
  const hidden = spaces.filter((s) => isHidden(s.externalId))
  const shown = showHidden ? spaces : visible

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-fit items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        {expanded ? 'Hide pots' : `See all pots (${visible.length})`}
      </button>

      {expanded && (
        <>
          <div className="flex flex-wrap gap-2">
            {shown.map((space) => {
              const hiddenState = isHidden(space.externalId)
              const Icon = space.spaceType === 'spending_space' ? Wallet : PiggyBank
              return (
                <ModuleGlassCard
                  key={space.externalId}
                  accent="blue"
                  size="sm"
                  className={`flex w-32 flex-col gap-1.5 ${hiddenState ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => onToggleHidden(space.externalId)}
                      aria-pressed={hiddenState}
                      aria-label={hiddenState ? `Show ${space.name}` : `Hide ${space.name}`}
                      className="shrink-0 rounded p-0.5 text-on-surface-variant hover:text-on-surface"
                    >
                      {hiddenState ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <span className="truncate text-xs font-medium text-on-surface">{space.name}</span>
                  <span className="text-xs text-on-surface-variant">{formatPounds(space.minorUnits)}</span>
                </ModuleGlassCard>
              )
            })}
          </div>

          {hidden.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className="w-fit text-[11px] text-on-surface-variant/70 hover:text-on-surface-variant"
            >
              {hidden.length} hidden · {showHidden ? 'hide' : 'show'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
