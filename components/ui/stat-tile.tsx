import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_TEXT, type UiAccent } from "@/lib/theme"
import { ProgressRing } from "./progress-ring"

export type StatTileProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The `label-caps` caption above the value. */
  label: React.ReactNode
  /** The number itself. */
  value: React.ReactNode
  /** Small suffix beside the value — "%", "IDX", "hrs". */
  unit?: React.ReactNode
  /** One supporting line under the value, truncated to a single line. */
  detail?: React.ReactNode
  /** 0–100. Omit to render the tile without a ring. */
  percent?: number
  /** Module accent for the ring and the icon. Defaults to neutral. */
  accent?: UiAccent
  /** 20px lucide icon centred in the ring; replaces the percentage readout. */
  icon?: React.ReactNode
  /** Tooltip explaining what the ring measures. */
  ringTitle?: string
  /** `md` renders the value at `headline-lg`, `lg` at hero `data-display`. */
  size?: "md" | "lg"
  /** `card` wraps the tile in a nested card; `bare` renders contents only. */
  variant?: "card" | "bare"
}

/**
 * Stat tile — DESIGN.md §4.7: a 64px progress ring beside a `data-display`
 * number and a `label-caps` caption. Reuses `<ProgressRing />` rather than
 * re-drawing the SVG.
 */
export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  (
    {
      className,
      label,
      value,
      unit,
      detail,
      percent,
      accent = "neutral",
      icon,
      ringTitle,
      size = "md",
      variant = "card",
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-3",
        variant === "card" && "rounded-xl border border-outline-variant bg-surface-container p-4",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="label-caps text-on-surface-variant">{label}</span>
        <span className="flex items-baseline gap-1.5">
          {/* Plain string, not cn(): `data-display` already carries the mono
              family, and running a font-size token through tailwind-merge
              next to a text colour would drop one of the two. */}
          <span
            className={
              size === "lg"
                ? "data-display tabular-nums text-primary"
                : "font-mono text-headline-lg font-semibold tabular-nums text-primary"
            }
          >
            {value}
          </span>
          {unit && <span className="text-xs text-on-surface-variant">{unit}</span>}
        </span>
        {detail && <span className="truncate text-xs text-on-surface-variant">{detail}</span>}
      </div>

      {percent != null && (
        <div title={ringTitle} className="shrink-0">
          <ProgressRing
            accent={accent}
            value={percent}
            size="md"
            aria-label={ringTitle}
            formatValue={
              icon
                ? () => <span className={ACCENT_TEXT[accent]}>{icon}</span>
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
)

StatTile.displayName = "StatTile"
