import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_BAR, ACCENT_SOFT, ACCENT_VAR, type UiAccent } from "@/lib/theme"

/**
 * Append-only vertical feed — DESIGN.md §4.9, the Workspaces thinking-log
 * pattern. `Timeline` is the `<ol>`; each `TimelineEntry` is an `<li>` with
 * a pinned accent dot, a nested `surface-container` card, a kind pill, a
 * timestamp, a relaxed body and an optional `#tag` footer.
 */
export const Timeline = React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol ref={ref} className={cn("relative flex flex-col gap-3", className)} {...props} />
  )
)

Timeline.displayName = "Timeline"

export type TimelineEntryProps = Omit<React.LiHTMLAttributes<HTMLLIElement>, "children"> & {
  /** Accent for the rail dot and the kind pill. Defaults to neutral. */
  accent?: UiAccent
  /** Label inside the kind pill. Omit for an entry with no kind. */
  kind?: React.ReactNode
  /** Optional lucide icon inside the kind pill. */
  kindIcon?: React.ReactNode
  /** Rendered right-aligned in the header, e.g. "Yesterday, 18:30". */
  timestamp?: React.ReactNode
  /** Machine-readable value for the `<time>` element. */
  dateTime?: string
  /** `#tag` footer. Interactive when `onTagClick` is supplied. */
  tags?: readonly string[]
  activeTag?: string | null
  onTagClick?: (tag: string) => void
  /** Small italic line under the body. */
  footnote?: React.ReactNode
  /** The entry body. */
  children?: React.ReactNode
}

export const TimelineEntry = React.forwardRef<HTMLLIElement, TimelineEntryProps>(
  (
    {
      className,
      accent = "neutral",
      kind,
      kindIcon,
      timestamp,
      dateTime,
      tags,
      activeTag = null,
      onTagClick,
      footnote,
      children,
      style,
      ...props
    },
    ref
  ) => (
    <li
      ref={ref}
      className={cn("relative pl-10", className)}
      style={{ "--tl-accent": ACCENT_VAR[accent], ...style } as React.CSSProperties}
      {...props}
    >
      <span
        className={cn(
          "absolute left-2.5 top-3.5 h-3 w-3 rounded-full shadow-[0_0_8px_var(--tl-accent)]",
          ACCENT_BAR[accent]
        )}
        aria-hidden
      />

      <div className="rounded-xl border border-outline-variant bg-surface-container p-4">
        {(kind || timestamp) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {kind ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 label-caps",
                  ACCENT_SOFT[accent]
                )}
              >
                {kindIcon}
                {kind}
              </span>
            ) : (
              <span />
            )}
            {timestamp && (
              <time dateTime={dateTime} className="label-caps tabular-nums text-outline">
                {timestamp}
              </time>
            )}
          </div>
        )}

        {children != null && (
          <div className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-on-surface">
            {children}
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  aria-pressed={activeTag === tag}
                  className={cn(
                    "rounded-sm px-1 label-caps transition-colors duration-[var(--duration-fast)] focus:outline-none focus-visible:underline",
                    activeTag === tag
                      ? "bg-secondary-fixed-dim/15 text-secondary-fixed-dim"
                      : "text-secondary-fixed-dim/70 hover:text-secondary-fixed-dim"
                  )}
                >
                  #{tag}
                </button>
              ) : (
                <span key={tag} className="label-caps text-secondary-fixed-dim">
                  #{tag}
                </span>
              )
            )}
          </div>
        )}

        {footnote && (
          <p className="mt-2 border-t border-outline-variant/40 pt-2 text-xs italic text-on-surface-variant/80">
            {footnote}
          </p>
        )}
      </div>
    </li>
  )
)

TimelineEntry.displayName = "TimelineEntry"
