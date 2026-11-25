import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_CHIP, type UiAccent } from "@/lib/theme"

export type ToggleChipOption<T extends string> = {
  value: T
  label: React.ReactNode
  /** Optional trailing count. */
  count?: number
}

export type ToggleChipsProps<T extends string> = {
  options: readonly ToggleChipOption<T>[]
  /** The values currently switched on. */
  value: readonly T[]
  onChange: (value: T[]) => void
  /** Accent a switched-on chip takes. Defaults to mint. */
  accent?: UiAccent
  className?: string
  /** Labels the group for screen readers, e.g. "Filter by type". */
  "aria-label"?: string
}

/**
 * Toggle chips — a multi-select row. The sibling of `FilterTabs` (which is
 * single-select): each chip is a `rounded-full` `label-caps` pill on
 * `surface-container-high` with the `outline-variant` hairline (DESIGN.md
 * §4.5/§4.1); switched on, it takes the accent at 10% fill with a 30% accent
 * border and accent text. Each chip is a native `aria-pressed` button, so
 * Enter and Space toggle it.
 */
export function ToggleChips<T extends string>({
  options,
  value,
  onChange,
  accent = "mint",
  className,
  "aria-label": ariaLabel,
}: ToggleChipsProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((option) => {
        const on = value.includes(option.value)

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((v) => v !== option.value) : [...value, option.value])
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 label-caps whitespace-nowrap",
              "transition-colors duration-[var(--duration-normal)] ease-standard motion-reduce:transition-none",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-outline",
              on
                ? ACCENT_CHIP[accent]
                : "border-outline-variant bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
            )}
          >
            {option.label}
            {option.count != null && (
              <span className={cn("tabular-nums", on ? "opacity-70" : "text-outline")}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
