import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils/cn"
import { ACCENT_GHOST, ACCENT_SOLID, ACCENT_VAR, type UiAccent } from "@/lib/theme"

/**
 * BIO-SYSTEM button — DESIGN.md §4.4.
 *
 * The seven recipes in the spec map onto these CVA variants:
 *
 * | DESIGN.md §4.4     | variant        |
 * | ------------------ | -------------- |
 * | Primary            | `default`      |
 * | Secondary          | `secondary`, `outline` (same weight, bordered) |
 * | Tertiary / quiet   | `quiet`, `ghost` (fully transparent) |
 * | Icon button        | `icon` + `size="icon"` |
 * | Destructive        | `destructive`  |
 * | Ghost accent       | `accent`       |
 * | Dashed placeholder | `dashed`       |
 *
 * `default`, `outline` and `ghost` keep the names the pre-reskin glinui
 * component used, so existing call sites are untouched. The glinui
 * `glass` / `frosted` / `liquid` / `matte` / `glow` variants were legacy
 * light-mode recipes with no users and have been removed.
 *
 * Colour for `default` and `accent` comes from the accent lookup tables in
 * `lib/theme.ts` rather than from CVA, so one component covers every module
 * accent without Tailwind having to see a computed class name.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent",
    "font-display font-semibold",
    "transition-all duration-[var(--duration-normal)] ease-standard motion-reduce:transition-none",
    // DESIGN.md §4.6: never a browser ring. Keyboard focus is the §4.3
    // Cyber Glow in the button's own accent instead.
    "focus:outline-none focus-visible:outline-none",
    "focus-visible:border-[var(--btn-accent)] focus-visible:shadow-[0_0_15px_color-mix(in_srgb,var(--btn-accent)_35%,transparent)]",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        // Fill + foreground are applied from ACCENT_SOLID below; the glow is
        // the spec's `shadow-lg shadow-<accent>/20`, driven off --btn-accent
        // so it follows whichever accent the caller picked.
        default: "shadow-[0_10px_24px_-14px_var(--btn-accent)] hover:brightness-110",
        secondary: "bg-surface-container-high text-on-surface hover:bg-surface-bright",
        outline:
          "border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-high",
        quiet:
          "bg-surface-container-lowest text-outline hover:bg-surface-container hover:text-on-surface-variant",
        ghost:
          "bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        icon: "border-outline-variant bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface",
        // Never red at rest (§4.4).
        destructive: "bg-transparent text-outline hover:bg-error-container hover:text-error",
        // Colour comes from ACCENT_GHOST below.
        accent: "",
        dashed:
          "border-dashed border-tertiary-fixed-dim/40 bg-transparent text-tertiary-fixed-dim hover:border-tertiary-fixed-dim/70 hover:bg-tertiary-fixed-dim/10",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Module accent. Drives the `default` fill and the `accent` variant; every
     *  variant uses it for the focus glow. Defaults to mint, as DESIGN.md §4.4
     *  specifies for the primary button. */
    accent?: UiAccent
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, accent = "mint", asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const accentClass =
      variant === "accent"
        ? ACCENT_GHOST[accent]
        : variant == null || variant === "default"
          ? ACCENT_SOLID[accent]
          : ""

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ size, variant }), accentClass, className)}
        style={{ "--btn-accent": ACCENT_VAR[accent], ...style } as React.CSSProperties}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { buttonVariants }
