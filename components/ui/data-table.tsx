import * as React from "react"

import { cn } from "@/lib/utils/cn"
import { ACCENT_SOFT, type UiAccent } from "@/lib/theme"

/**
 * Data-table primitives — DESIGN.md §4.8 (the Instagram Follows pattern).
 *
 * Deliberately compositional: these are `table` / `thead` / `tr` / `td`
 * wrappers that carry the BIO-SYSTEM recipe and nothing else, so each module
 * keeps its own data, sorting and selection logic.
 *
 * ```tsx
 * <DataTable>
 *   <DataTableHead>
 *     <tr>
 *       <DataTableHeaderCell>Handle</DataTableHeaderCell>
 *       <DataTableHeaderCell align="right">Followed</DataTableHeaderCell>
 *     </tr>
 *   </DataTableHead>
 *   <DataTableBody>
 *     {rows.map((row) => (
 *       <DataTableRow key={row.id} selected={selected.has(row.id)}>
 *         <DataTableCell>{row.handle}</DataTableCell>
 *         <DataTableCell align="right">
 *           <DataTableRowActions>{...}</DataTableRowActions>
 *         </DataTableCell>
 *       </DataTableRow>
 *     ))}
 *   </DataTableBody>
 * </DataTable>
 * ```
 */

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const

export type TableAlign = keyof typeof ALIGN_CLASS

export type DataTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  /** Classes for the scroll container wrapping the table. */
  containerClassName?: string
}

export const DataTable = React.forwardRef<HTMLTableElement, DataTableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("w-full overflow-x-auto", containerClassName)}>
      <table
        ref={ref}
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      />
    </div>
  )
)

DataTable.displayName = "DataTable"

export const DataTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />)

DataTableHead.displayName = "DataTableHead"

export type DataTableHeaderCellProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: TableAlign
}

export const DataTableHeaderCell = React.forwardRef<HTMLTableCellElement, DataTableHeaderCellProps>(
  ({ className, align = "left", ...props }, ref) => (
    <th
      ref={ref}
      scope="col"
      className={cn(
        "border-b border-outline-variant bg-surface-container-lowest px-4 py-3 label-caps text-on-surface-variant",
        ALIGN_CLASS[align],
        className
      )}
      {...props}
    />
  )
)

DataTableHeaderCell.displayName = "DataTableHeaderCell"

export const DataTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />)

DataTableBody.displayName = "DataTableBody"

export type DataTableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  /** Applies the §4.8 selected-row wash. */
  selected?: boolean
}

export const DataTableRow = React.forwardRef<HTMLTableRowElement, DataTableRowProps>(
  ({ className, selected = false, ...props }, ref) => (
    <tr
      ref={ref}
      data-selected={selected || undefined}
      className={cn(
        // `group` so a row hover can reveal its per-row affordances.
        "group border-b border-outline-variant/40 transition-colors duration-[var(--duration-fast)] hover:bg-surface-container/60",
        selected && "bg-surface-container-lowest/40",
        className
      )}
      {...props}
    />
  )
)

DataTableRow.displayName = "DataTableRow"

export type DataTableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: TableAlign
}

export const DataTableCell = React.forwardRef<HTMLTableCellElement, DataTableCellProps>(
  ({ className, align = "left", ...props }, ref) => (
    <td
      ref={ref}
      className={cn("px-4 py-3 align-middle text-on-surface", ALIGN_CLASS[align], className)}
      {...props}
    />
  )
)

DataTableCell.displayName = "DataTableCell"

/** Per-row affordances that only appear on row hover or keyboard focus. */
export const DataTableRowActions = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100 focus-within:opacity-100",
      className
    )}
    {...props}
  />
))

DataTableRowActions.displayName = "DataTableRowActions"

/** The strip that appears above the table when any row is checked (§4.8). */
export const DataTableBulkBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2.5",
      className
    )}
    {...props}
  />
))

DataTableBulkBar.displayName = "DataTableBulkBar"

export type DataTableAvatarProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Initial is taken from here when no children are supplied. */
  name?: string
  /** The row's category, encoded as the avatar tint (§4.8). */
  accent?: UiAccent
}

/**
 * 36px initial avatar whose fill is the accent at 20% — the §4.8 way of
 * encoding a row's category at a glance.
 */
export const DataTableAvatar = React.forwardRef<HTMLSpanElement, DataTableAvatarProps>(
  ({ className, name, accent = "neutral", children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-xs font-bold",
        ACCENT_SOFT[accent],
        className
      )}
      {...props}
    >
      {children ?? name?.trim().charAt(0).toUpperCase() ?? ""}
    </span>
  )
)

DataTableAvatar.displayName = "DataTableAvatar"
