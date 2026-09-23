import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_TEXT, type UiAccent } from "@/lib/theme"

export type CountBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  count: number
  /** Accent for the numeral. Defaults to neutral. */
  accent?: UiAccent
  /** Render as `{max}+` above this value. */
  max?: number
}

/**
 * Count badge — DESIGN.md §4.5. A pill on `surface-container-highest` with
 * accent `label-caps` text, sitting immediately after a section heading.
 */
export const CountBadge = React.forwardRef<HTMLSpanElement, CountBadgeProps>(
  ({ className, count, accent = "neutral", max, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full bg-surface-container-highest px-2 py-0.5 label-caps tabular-nums",
        ACCENT_TEXT[accent],
        className
      )}
      {...props}
    >
      {max != null && count > max ? `${max}+` : count}
    </span>
  )
)

CountBadge.displayName = "CountBadge"
