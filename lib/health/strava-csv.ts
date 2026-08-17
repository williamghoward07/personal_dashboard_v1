// Maps Strava's bulk-export activities.csv (parsed into header-keyed rows
// by papaparse) to candidate activity sessions. Column matching is
// verified only against community parsing tooling's source
// (github.com/mattpopovich/ParseStravaBulkExport confirms "Activity
// Type", "Activity Date", "Activity Name", and "Filename" as literal
// headers) — not an official Strava spec, and not checked against a real
// export file. Distance/elapsed-time/elevation-gain column names follow
// the same Title Case convention but aren't independently confirmed,
// and Strava's documented raw units (meters, seconds) are assumed. If a
// real export disagrees, this is the first thing to check — the mandatory
// review step downstream is what actually catches a wrong guess before
// anything commits, the same way it does for PDF statement import.

export interface StravaActivityCandidate {
  occurred_at: string
  activity_type: string
  duration_minutes: number | null
  distance_km: number | null
  elevation_gain_m: number | null
  external_id: string | null
}

export interface StravaCsvParseResult {
  candidates: StravaActivityCandidate[]
  skippedRows: number
  totalRows: number
}

function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = headers.find((h) => pattern.test(h))
    if (match) return match
  }
  return null
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

export function parseStravaCsvRows(rows: Record<string, string>[]): StravaCsvParseResult {
  if (rows.length === 0) return { candidates: [], skippedRows: 0, totalRows: 0 }

  const headers = Object.keys(rows[0])
  const dateCol = findColumn(headers, [/^activity date$/i, /date/i])
  const typeCol = findColumn(headers, [/^activity type$/i, /^type$/i])
  const idCol = findColumn(headers, [/^activity id$/i])
  const distanceCol = findColumn(headers, [/^distance$/i])
  const durationCol = findColumn(headers, [/^moving time$/i, /^elapsed time$/i, /time/i])
  const elevationCol = findColumn(headers, [/elevation gain/i])

  const candidates: StravaActivityCandidate[] = []
  let skippedRows = 0

  for (const row of rows) {
    const dateRaw = dateCol ? row[dateCol] : undefined
    const typeRaw = typeCol ? row[typeCol] : undefined

    if (!dateRaw || !typeRaw) {
      skippedRows++
      continue
    }

    const occurredAt = new Date(dateRaw)
    if (Number.isNaN(occurredAt.getTime())) {
      skippedRows++
      continue
    }

    const distanceMeters = distanceCol ? parseNumber(row[distanceCol]) : null
    const durationSeconds = durationCol ? parseNumber(row[durationCol]) : null
    const elevationMeters = elevationCol ? parseNumber(row[elevationCol]) : null

    candidates.push({
      occurred_at: occurredAt.toISOString(),
      activity_type: typeRaw,
      duration_minutes: durationSeconds != null ? Math.round(durationSeconds / 60) : null,
      distance_km: distanceMeters != null ? Math.round((distanceMeters / 1000) * 100) / 100 : null,
      elevation_gain_m: elevationMeters != null ? Math.round(elevationMeters) : null,
      external_id: idCol ? (row[idCol] || null) : null,
    })
  }

  return { candidates, skippedRows, totalRows: rows.length }
}
