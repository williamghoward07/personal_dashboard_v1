import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils/cn"

/**
 * BIO-SYSTEM progress bar and ring — DESIGN.md §4.7.
 *
 * Track is `surface-container-highest`; the value is drawn in the module
 * accent, read from `--color-accent` so a caller can point it at any accent
 * (that is exactly what `progress-ring.tsx` does). The glinui
 * `glass` / `liquid` / `matte` variants were legacy light-mode recipes with
 * no users and have been removed, so there is no longer a `variant` prop.
 */
const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-surface-container-highest",
  {
    variants: {
      size: {
        sm: "h-2",
        md: "h-3",
        lg: "h-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

const progressCircleVariants = cva("relative inline-flex shrink-0 items-center justify-center", {
  variants: {
    size: {
      sm: "h-12 w-12 text-[11px]",
      md: "h-16 w-16 text-xs",
      lg: "h-24 w-24 text-sm",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

export type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressVariants> & {
    /** Current progress value from 0 to 100. */
    value?: number
    /** Render loading state without aria-valuenow and fixed width indicator. */
    indeterminate?: boolean
  }

export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, size, indeterminate = false, ...props }, ref) => {
  const clampedValue = Math.max(0, Math.min(100, value ?? 0))

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(progressVariants({ size }), className)}
      value={indeterminate ? undefined : clampedValue}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-[var(--duration-normal)] ease-standard motion-reduce:transition-none",
          indeterminate && "w-1/2 opacity-85 motion-safe:animate-pulse motion-reduce:animate-none"
        )}
        style={indeterminate ? undefined : { width: `${clampedValue}%` }}
      />
    </ProgressPrimitive.Root>
  )
})

Progress.displayName = "Progress"

export type ProgressCircleProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> &
  VariantProps<typeof progressCircleVariants> & {
    value?: number
    strokeWidth?: number
    cap?: "round" | "square" | "butt"
    indeterminate?: boolean
    showValue?: boolean
    formatValue?: (value: number) => React.ReactNode
  }

export const ProgressCircle = React.forwardRef<HTMLDivElement, ProgressCircleProps>(
  (
    {
      className,
      value,
      size,
      // DESIGN.md §4.7: viewBox "0 0 36 36" at stroke-width 3.
      strokeWidth = 3,
      cap = "round",
      indeterminate = false,
      showValue = true,
      formatValue,
      ...props
    },
    ref
  ) => {
    const clampedValue = Math.max(0, Math.min(100, value ?? 0))
    const normalizedStrokeWidth = Math.max(2, Math.min(10, strokeWidth))
    const viewBoxSize = 36
    const center = viewBoxSize / 2
    const radius = center - normalizedStrokeWidth / 2
    const circumference = 2 * Math.PI * radius
    const dashOffset = indeterminate
      ? circumference * 0.25
      : circumference - (clampedValue / 100) * circumference
    const dashArray = indeterminate ? circumference * 0.7 : circumference

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : clampedValue}
        className={cn(progressCircleVariants({ size }), className)}
        {...props}
      >
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className={cn("size-full -rotate-90", indeterminate && "motion-safe:animate-spin")}
          aria-hidden="true"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={normalizedStrokeWidth}
            className="fill-none stroke-surface-container-highest"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={normalizedStrokeWidth}
            strokeLinecap={cap}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            className="fill-none stroke-[var(--color-accent)] drop-shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent)_50%,transparent)] transition-[stroke-dashoffset,stroke] duration-[var(--duration-normal)] ease-standard motion-reduce:transition-none"
          />
        </svg>
        {showValue && !indeterminate ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display font-semibold text-on-surface">
            {formatValue ? formatValue(clampedValue) : `${Math.round(clampedValue)}%`}
          </span>
        ) : null}
      </div>
    )
  }
)

ProgressCircle.displayName = "ProgressCircle"
