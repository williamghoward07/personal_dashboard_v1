/**
 * 'Fri 20 Nov' for a YYYY-MM-DD string, with the year added only when it
 * isn't `currentYear`. Parsed as a plain calendar day (no timezone shift);
 * anything unparseable comes back unchanged.
 */
export function formatDraftDate(value: string, currentYear: number = new Date().getFullYear()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return value
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d, 12))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return value
  const base = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
    .format(date)
    .replace(',', '')
  return y === currentYear ? base : `${base} ${y}`
}
