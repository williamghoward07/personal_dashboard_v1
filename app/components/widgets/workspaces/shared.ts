// Shared class strings and formatters for the Workspaces module. Class
// strings follow the per-module convention of reusing the app-wide input/
// label/button shapes and swapping only the focus/accent colour.

export const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-workspace-teal'

export const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export const actionButtonClass =
  'flex items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40'

export const primaryButtonClass =
  'flex items-center gap-1.5 rounded-md bg-workspace-teal px-3 py-1.5 text-xs font-semibold text-surface-container-lowest transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40'

export const ghostButtonClass =
  'rounded-md px-2.5 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface'

export const iconButtonClass =
  'rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30'

export const filterChipClass = 'rounded-full border px-2.5 py-1 text-xs transition-colors'
export const filterChipActiveClass = 'border-workspace-teal/50 bg-workspace-teal/10 text-workspace-teal'
export const filterChipInactiveClass = 'border-outline-variant text-on-surface-variant hover:border-outline'

export const microLabelClass =
  'font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70'

export const columnCardClass = 'flex flex-col gap-3'

/** "2h ago", "3 days ago", "just now" — the header/footer meta style. */
export function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null

  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`

  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "14:15 today", "Yesterday, 18:30", "Oct 12, 09:40" — Thinking Log stamps. */
export function logTimestamp(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDelta = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)

  if (dayDelta === 0) return `Today, ${time}`
  if (dayDelta === 1) return `Yesterday, ${time}`
  if (dayDelta < 7) return `${dayDelta} days ago, ${time}`
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
