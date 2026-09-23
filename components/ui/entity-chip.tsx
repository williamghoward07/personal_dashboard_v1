import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_BORDER, ACCENT_SOFT, type UiAccent } from "@/lib/theme"

export type EntityChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** The linked record's display name. */
  name: string
  /** Accent for the avatar tint and the 30% border. Defaults to neutral. */
  accent?: UiAccent
  /** Replaces the default initial avatar — an <img>, an icon, an emoji. */
  avatar?: React.ReactNode
  /** Renders the close button when supplied. */
  onRemove?: () => void
  /** Accessible name for the close button. Defaults to `Remove {name}`. */
  removeLabel?: string
}

/**
 * Entity chip (linked record) — DESIGN.md §4.5. A pill on
 * `surface-container-high` with a 30%-opacity accent border, a 16px circular
 * avatar, the name in `primary`, and a close button that turns `error` on
 * hover.
 */
export const EntityChip = React.forwardRef<HTMLSpanElement, EntityChipProps>(
  ({ className, name, accent = "neutral", avatar, onRemove, removeLabel, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-surface-container-high px-3 py-1.5",
        ACCENT_BORDER[accent],
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-[9px] font-bold",
          ACCENT_SOFT[accent]
        )}
        aria-hidden
      >
        {avatar ?? name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="truncate text-sm text-primary">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${name}`}
          className="-mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-outline transition-colors duration-[var(--duration-fast)] hover:text-error focus:outline-none focus-visible:text-error"
        >
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  )
)

EntityChip.displayName = "EntityChip"
