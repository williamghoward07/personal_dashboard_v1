import type { Transaction, TransactionSource } from './types'

// Starling's feed includes items that never actually moved money — a
// declined card auth, a reversed/retracted payment, or a $0 account check.
// These did happen (in the sense of being a real feed event), just not
// successfully, so they're excluded from balance/spending math but still
// shown in the transactions list, styled to flag they failed/were zero.
const FAILED_OR_ZERO_STARLING_STATUSES = new Set([
  'DECLINED',
  'REVERSED',
  'RETRACTED',
  'ACCOUNT_CHECK',
])

// A standing order that hasn't fired yet — not a failure, just not a real
// event yet, so it's excluded outright rather than shown.
const PENDING_STARLING_STATUSES = new Set(['UPCOMING'])

const UNSUCCESSFUL_STARLING_STATUSES = new Set([
  ...FAILED_OR_ZERO_STARLING_STATUSES,
  ...PENDING_STARLING_STATUSES,
])

export function isSuccessfulStarlingStatus(status: string | null | undefined): boolean {
  return typeof status !== 'string' || !UNSUCCESSFUL_STARLING_STATUSES.has(status)
}

export function isPendingStarlingStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && PENDING_STARLING_STATUSES.has(status)
}

function starlingStatusOf(transaction: Transaction): string | null {
  const raw = transaction.raw
  const status = raw && typeof raw === 'object' ? (raw as { status?: unknown }).status : undefined
  return typeof status === 'string' ? status : null
}

// Manual entries have no external status to check, so they're always kept —
// this only filters out bank-synced rows that never actually happened.
export function isSuccessfulTransaction(transaction: Transaction): boolean {
  if (transaction.source !== 'starling') return true
  return isSuccessfulStarlingStatus(starlingStatusOf(transaction))
}

// Declined card auths, reversed/retracted payments, and $0 account checks —
// real feed events that never (successfully) moved money. Used to flag
// these rows red in the transactions list rather than hiding them.
export function isFailedOrZeroTransaction(transaction: Transaction): boolean {
  if (transaction.source !== 'starling') return false
  const status = starlingStatusOf(transaction)
  return status !== null && FAILED_OR_ZERO_STARLING_STATUSES.has(status)
}

export type ChangePeriod = 'day' | 'week' | 'month' | '3month'

const PERIOD_DAYS: Record<ChangePeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
  '3month': 90,
}

export const CHANGE_PERIOD_OPTIONS: readonly { value: ChangePeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '3month', label: '3M' },
]

// Rolling window (not calendar-aligned) net change for a given source, in
// minor units — used for the Starling balance card's period switcher.
export function netChangeMinorUnits(
  transactions: Transaction[],
  period: ChangePeriod,
  source?: TransactionSource
): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period])
  const cutoffKey = cutoff.toISOString().slice(0, 10)

  return transactions
    .filter((t) => t.date >= cutoffKey && (!source || t.source === source))
    .reduce((sum, t) => sum + (t.type === 'income' ? minorUnitsOf(t) : -minorUnitsOf(t)), 0)
}

// amount_minor_units is authoritative for bank-synced rows; manual rows
// only ever populate amount (pounds), so fall back to converting that —
// the only place a manual-entry pound value gets turned into pence.
export function minorUnitsOf(transaction: Transaction): number {
  if (transaction.amount_minor_units != null) return transaction.amount_minor_units
  if (transaction.amount != null) return Math.round(transaction.amount * 100)
  return 0
}

export function formatPounds(minorUnits: number): string {
  const sign = minorUnits < 0 ? '-' : ''
  return `${sign}£${(Math.abs(minorUnits) / 100).toFixed(2)}`
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diffMinutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}
