import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils/cn"
import { ACCENT_FOCUS, type UiAccent } from "@/lib/theme"

/**
 * BIO-SYSTEM text input — DESIGN.md §4.6.
 *
 * Focus is a border-colour change to the module accent plus the §4.3 Cyber
 * Glow, never a browser ring — `focus:outline-none` is universal here. The
 * accent classes come from `ACCENT_FOCUS` in `lib/theme.ts`.
 *
 * Variants: `default` is the chrome input (`rounded-lg`), `card` the in-card
 * one (`rounded-xl`), `outline` the unfilled bordered form, and `ghost` the
 * inline-editable cell — transparent at rest, announcing itself only on
 * hover/focus. The glinui `glass` / `frosted` / `liquid` / `matte` /
 * `underline` / `filled` variants were legacy light-mode recipes with no
 * users and are gone.
 *
 * For a leading icon, position it absolutely at `left-3` in a
 * `relative` wrapper and pass `className="pl-9"`.
 */
const inputVariants = cva(
  [
    "w-full border text-on-surface placeholder:text-outline",
    "transition-[background-color,border-color,box-shadow,color] duration-[var(--duration-normal)] ease-standard motion-reduce:transition-none",
    "focus:outline-none focus-visible:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "rounded-lg border-outline-variant bg-surface-container-high",
        card: "rounded-xl border-outline-variant bg-surface-container-high",
        outline: "rounded-lg border-outline-variant bg-transparent hover:border-outline",
        ghost:
          "rounded-lg border-transparent bg-transparent hover:bg-surface-container focus:bg-surface-container",
      },
      size: {
        // text-sm / text-base are the same 14/20 and 16/24 as DESIGN.md's
        // body-sm / body-md; the core scale is used here so a caller's own
        // `text-*` override still resolves predictably through cn().
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-3.5 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants> & {
    /** Module accent for the focus border + glow. Defaults to mint. */
    accent?: UiAccent
  }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, accent = "mint", type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(inputVariants({ variant, size }), ACCENT_FOCUS[accent], className)}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { inputVariants }
