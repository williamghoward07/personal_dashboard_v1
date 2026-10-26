'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, CheckCheck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { UiAccent } from '@/lib/theme'
import { UNDO_HAND_IN, handInPatch, type SessionStatePatch } from '@/lib/lectures/prep-writes'

/** How long the "Done" confirmation holds before settling into the done state. */
export const CONFIRM_MS = 1200

const MINT_GLOW = 'shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary-container)_45%,transparent)]'

/**
 * Teams' "Turn in": the only thing that turns prep green, ticked or not.
 * Hover previews the done colour; a click pops into a solid "Done" with a
 * ring burst (DESIGN.md §6's one hand-in exception), then settles into a
 * mint "Done" that reads "Undo" on hover.
 */
export default function HandInButton({
  prepDone,
  accent,
  size = 'sm',
  className,
  onSaveState,
}: {
  prepDone: boolean
  accent: UiAccent
  size?: 'sm' | 'md'
  className?: string
  onSaveState: (patch: SessionStatePatch) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const handIn = () => {
    setConfirming(true)
    onSaveState(handInPatch())
    timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS)
  }

  if (confirming) {
    return (
      <Button
        size={size}
        accent="mint"
        aria-live="polite"
        className={cn('pointer-events-none relative', MINT_GLOW, className)}
      >
        <span className="hand-in-burst pointer-events-none absolute inset-0 rounded-lg" aria-hidden />
        <Check className="hand-in-pop h-4 w-4" strokeWidth={3} />
        Done
      </Button>
    )
  }

  if (prepDone) {
    return (
      <Button
        variant="outline"
        size={size}
        accent="mint"
        aria-label="Undo mark as done"
        className={cn(
          'group border-primary-container/40 bg-primary-container/10 text-primary-container',
          'hover:border-outline-variant hover:bg-surface-container-high hover:text-on-surface',
          className
        )}
        onClick={() => onSaveState(UNDO_HAND_IN)}
      >
        <span className="inline-flex items-center gap-2 group-hover:hidden">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          Done
        </span>
        <span className="hidden items-center gap-2 group-hover:inline-flex">
          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Undo
        </span>
      </Button>
    )
  }

  return (
    <Button
      size={size}
      accent={accent}
      className={cn(
        'group hover:bg-primary-container hover:text-on-primary-container hover:brightness-100',
        'hover:shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary-container)_45%,transparent)]',
        'hover:scale-[1.03] motion-reduce:hover:scale-100',
        className
      )}
      onClick={handIn}
    >
      <CheckCheck
        className="h-3.5 w-3.5 transition-transform group-hover:scale-125 motion-reduce:group-hover:scale-100"
        strokeWidth={1.75}
      />
      Mark as done
    </Button>
  )
}
