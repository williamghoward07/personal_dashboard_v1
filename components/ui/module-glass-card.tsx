import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_VAR, type Accent } from "@/lib/theme"
import { GlassCard, type GlassCardProps } from "./glass-card"

export type ModuleGlassCardProps = GlassCardProps & {
  /** Module accent used for the hover glow. Defaults to neutral (no glow). */
  accent?: Accent
}

export const ModuleGlassCard = React.forwardRef<HTMLDivElement, ModuleGlassCardProps>(
  ({ accent = "neutral", className, style, ...props }, ref) => (
    <GlassCard
      ref={ref}
      style={{ "--color-accent": ACCENT_VAR[accent], ...style } as React.CSSProperties}
      className={cn(
        "transition-shadow duration-[var(--duration-normal)] ease-standard hover:shadow-[0_0_32px_-10px_var(--color-accent)]",
        className
      )}
      {...props}
    />
  )
)

ModuleGlassCard.displayName = "ModuleGlassCard"
