import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_SOLID, type UiAccent } from "@/lib/theme"

export type FilterTabOption<T extends string> = {
  value: T
  label: React.ReactNode
  /** Optional trailing count, e.g. "ALL 128". */
  count?: number
  /** Optional leading lucide icon. */
  icon?: React.ReactNode
}

export type FilterTabsProps<T extends string> = {
  options: readonly FilterTabOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accent the active tab inverts to. Defaults to mint. */
  accent?: UiAccent
  /** `md` is the standalone control; `compact` is the in-card form. */
  size?: "md" | "compact"
  className?: string
  /** Labels the group for screen readers, e.g. "Filter follows". */
  "aria-label"?: string
}

/**
 * Filter tabs — DESIGN.md §4.10. A segmented control: `p-1
 * bg-surface-container rounded-xl` holding `rounded-lg` `label-caps`
 * buttons, with the active tab inverted to a solid accent fill.
 *
 * Deliberately *not* the same component as `app/components/LiquidSwitch.tsx`:
 * that one is the AI query bar's mode switch — a glass pill that slides and
 * tints the active label rather than inverting it — and it is named in
 * CLAUDE.md as its own shared building block. The prop signature here is
 * kept identical to LiquidSwitch's (`options` / `value` / `onChange` /
 * `accent`) so the two are drop-in swappable.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  accent = "mint",
  size = "md",
  className,
  "aria-label": ariaLabel,
}: FilterTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-xl bg-surface-container p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 label-caps whitespace-nowrap transition-all duration-[var(--duration-normal)] ease-standard motion-reduce:transition-none",
              "focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-outline",
              size === "compact" ? "rounded-md px-2.5 py-1" : "rounded-lg px-3 py-1.5",
              active ? ACCENT_SOLID[accent] : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {option.icon}
            {option.label}
            {option.count != null && (
              <span className={cn("tabular-nums", active ? "opacity-70" : "text-outline")}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
