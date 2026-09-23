import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_BADGE, ACCENT_BAR, type UiAccent } from "@/lib/theme"

/** How the leading dot behaves: steady, "active", or "live / streaming". */
export type StatusDot = boolean | "static" | "pulse" | "ping"

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Module or status accent. Defaults to mint ("System Nominal"). */
  accent?: UiAccent
  /** Leading 6px dot. `true` === `"static"`. DESIGN.md §4.5. */
  dot?: StatusDot
  /** Optional leading lucide icon, rendered after the dot. */
  icon?: React.ReactNode
  /** `md` is the spec pill (`px-3 py-1`); `sm` is the in-row form. */
  size?: "sm" | "md"
}

/**
 * Strong status badge — DESIGN.md §4.5. A pill with the accent at 15%
 * background, a 1px solid accent border, accent `label-caps` text and an
 * optional leading dot: `animate-pulse` when live, `animate-ping` when
 * streaming.
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, accent = "mint", dot = false, icon, size = "md", children, ...props }, ref) => {
    const state: Exclude<StatusDot, boolean> = dot === true ? "static" : dot === false ? "static" : dot
    const dotBg = ACCENT_BAR[accent]

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border label-caps whitespace-nowrap",
          size === "md" ? "px-3 py-1" : "px-2 py-0.5",
          ACCENT_BADGE[accent],
          className
        )}
        {...props}
      >
        {dot !== false &&
          (state === "ping" ? (
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping",
                  dotBg
                )}
              />
              <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dotBg)} />
            </span>
          ) : (
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                dotBg,
                state === "pulse" && "motion-safe:animate-pulse"
              )}
              aria-hidden
            />
          ))}
        {icon}
        {children}
      </span>
    )
  }
)

StatusBadge.displayName = "StatusBadge"
