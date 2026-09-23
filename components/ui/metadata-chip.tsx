import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_TEXT, type UiAccent } from "@/lib/theme"

export type MetadataChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Accent for the label. Defaults to neutral. */
  accent?: UiAccent
  /** Optional leading lucide icon, sized by the caller (12–14px reads best). */
  icon?: React.ReactNode
}

/**
 * Metadata chip — DESIGN.md §4.5. The squared-off (4px) sibling of
 * `CountBadge`, used in meta lines: "6 Sources", "4 Scoped Actions".
 */
export const MetadataChip = React.forwardRef<HTMLSpanElement, MetadataChipProps>(
  ({ className, accent = "neutral", icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-surface-container-highest px-2 py-0.5 label-caps whitespace-nowrap",
        ACCENT_TEXT[accent],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
)

MetadataChip.displayName = "MetadataChip"
