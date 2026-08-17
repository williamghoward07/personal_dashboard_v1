// Pure iCalendar (RFC 5545) handling for Apple Reminders' VTODO
// components — no network, no tsdav dependency, so this is testable with
// plain text fixtures like every other pure module in this app.

export interface ParsedVTodo {
  caldav_uid: string
  title: string
  due_date: string | null
  completed_at: string | null
  notes: string | null
}

// Long property values can be "folded" across multiple lines — a
// continuation line starts with a space or tab, which gets stripped as
// the line is rejoined onto the previous one.
function unfoldLines(ics: string): string[] {
  const rawLines = ics.split(/\r\n|\n|\r/)
  const unfolded: string[] = []
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }
  return unfolded
}

function parseProperty(line: string): { name: string; value: string } | null {
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) return null
  // Only the property name matters here (e.g. "DUE" out of
  // "DUE;VALUE=DATE") — parameters like VALUE=DATE don't change how we
  // map the value, since parseIcsDate already distinguishes a bare date
  // from a date-time by its length.
  const name = line.slice(0, colonIndex).split(';')[0].toUpperCase()
  const value = line.slice(colonIndex + 1)
  return { name, value }
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

// 'YYYYMMDD' (DATE) or 'YYYYMMDDTHHMMSS[Z]' (DATE-TIME) -> ISO-ish.
function parseIcsDate(value: string): string | null {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!match) return null
  const [, y, mo, d, h, mi, s, z] = match
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`
}

// Every VTODO in the blob (a CalDAV REPORT typically wraps one per
// VCALENDAR, but this handles multiple just as well). A component
// missing UID or SUMMARY is skipped rather than throwing — one malformed
// reminder shouldn't take down the whole sync. completedAtFallback is
// used only when STATUS says COMPLETED but no COMPLETED timestamp is
// present (real Reminders entries normally have one; this is a rare
// edge case) — passed in rather than read from the wall clock so this
// stays a pure, deterministic function.
export function parseVTodos(ics: string, completedAtFallback: string): ParsedVTodo[] {
  const lines = unfoldLines(ics)
  const results: ParsedVTodo[] = []

  let inVTodo = false
  let current: Record<string, string> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VTODO') {
      inVTodo = true
      current = {}
      continue
    }
    if (line === 'END:VTODO') {
      inVTodo = false
      const uid = current.UID
      const summary = current.SUMMARY
      if (uid && summary) {
        results.push({
          caldav_uid: uid,
          title: unescapeText(summary),
          due_date: current.DUE ? (parseIcsDate(current.DUE)?.slice(0, 10) ?? null) : null,
          completed_at: current.COMPLETED
            ? parseIcsDate(current.COMPLETED)
            : current.STATUS === 'COMPLETED'
              ? completedAtFallback
              : null,
          notes: current.DESCRIPTION ? unescapeText(current.DESCRIPTION) : null,
        })
      }
      continue
    }
    if (!inVTodo) continue

    const prop = parseProperty(line)
    if (prop) current[prop.name] = prop.value
  }

  return results
}

function toIcsTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Flips a single VTODO's completion state in place, textually — used to
// push a completion (in either direction) back to Reminders after the
// user toggles a CalDAV-linked todo in the app. Replaces any existing
// STATUS/COMPLETED lines inside the VTODO block rather than appending,
// so the result stays valid iCalendar (a property may only appear once).
// nowIso is passed in for the same determinism reason as
// completedAtFallback above.
export function setVTodoCompletion(ics: string, completed: boolean, nowIso: string): string {
  const lines = ics.split(/\r\n|\n|\r/)
  const result: string[] = []
  let inVTodo = false

  for (const line of lines) {
    if (line === 'BEGIN:VTODO') inVTodo = true
    if (line === 'END:VTODO') inVTodo = false

    if (inVTodo && /^STATUS[:;]/i.test(line)) continue
    if (inVTodo && /^COMPLETED[:;]/i.test(line)) continue

    result.push(line)

    if (line === 'BEGIN:VTODO') {
      result.push(`STATUS:${completed ? 'COMPLETED' : 'NEEDS-ACTION'}`)
      if (completed) result.push(`COMPLETED:${toIcsTimestamp(nowIso)}`)
    }
  }

  return result.join('\r\n')
}
