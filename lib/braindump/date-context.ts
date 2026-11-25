import { addDays, dateKey, londonYMD } from '@/lib/google/london-day'

const TZ = 'Europe/London'
const TABLE_DAYS = 14

/** 'Mon 16 Nov' for a calendar day (noon UTC keeps it clear of DST edges). */
export function shortDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
    .replace(',', '')
}

/**
 * Prompt block giving the model today's London date plus a 14-day lookup
 * table, because models are unreliable at weekday arithmetic.
 */
export function buildDateContext(now: Date): string {
  const today = londonYMD(now)
  const todayKey = dateKey(today)
  const long = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)

  const rows: string[] = []
  for (let i = 0; i < TABLE_DAYS; i++) {
    const key = dateKey(addDays(today, i))
    const names = i === 0 ? 'today, ' : i === 1 ? 'tomorrow, ' : ''
    rows.push(`- ${names}${shortDayLabel(key)} = ${key}`)
  }

  return [
    `Today: ${long.replace(',', '')} (${todayKey}), ${time} Europe/London time.`,
    'Date lookup — copy dates from this table, never calculate them:',
    ...rows,
  ].join('\n')
}
