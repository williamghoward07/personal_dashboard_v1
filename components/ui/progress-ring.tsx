import * as React from "react"

import { ACCENT_VAR, type UiAccent } from "@/lib/theme"
import { ProgressCircle, type ProgressCircleProps } from "./progress"

export type ProgressRingProps = ProgressCircleProps & {
  /** Module accent driving the ring's fill color. Defaults to neutral. */
  accent?: UiAccent
}

export const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  ({ accent = "neutral", style, ...props }, ref) => (
    <ProgressCircle
      ref={ref}
      style={{ "--color-accent": ACCENT_VAR[accent], ...style } as React.CSSProperties}
      {...props}
    />
  )
)

ProgressRing.displayName = "ProgressRing"
