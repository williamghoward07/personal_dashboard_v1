import 'server-only'
import { createDAVClient, type DAVCalendar, type DAVCalendarObject } from 'tsdav'
import { parseVTodos, setVTodoCompletion } from './parse-vtodo'

// Apple doesn't support OAuth for CalDAV — auth is Basic with an
// app-specific password generated once at appleid.apple.com. Env vars
// only (no per-user encrypted-token row like Contacts/Calendar use) —
// this is a single static credential in a single-user app, not something
// that needs refresh-token rotation or multi-provider bookkeeping.
const CALDAV_SERVER_URL = 'https://caldav.icloud.com'

async function getClient() {
  const username = process.env.ICLOUD_CALDAV_USERNAME
  const password = process.env.ICLOUD_CALDAV_APP_PASSWORD
  if (!username || !password) {
    throw new Error('ICLOUD_CALDAV_USERNAME/ICLOUD_CALDAV_APP_PASSWORD are not configured')
  }

  return createDAVClient({
    serverUrl: CALDAV_SERVER_URL,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })
}

type DAVClient = Awaited<ReturnType<typeof createDAVClient>>

// ICLOUD_CALDAV_LIST_NAME picks specific lists by display name — a single
// name, or a comma-separated list of names (e.g. "Durham,Personal") to
// sync several lists into the same flat pool. Unset returns null, meaning
// "use the default list" (see findRemindersLists).
function configuredListNames(): string[] | null {
  const raw = process.env.ICLOUD_CALDAV_LIST_NAME
  if (!raw) return null
  const names = raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return names.length > 0 ? names : null
}

// iCloud's CalDAV home returns every calendar the account has, including
// ordinary event calendars — narrow to VTODO-capable collections (i.e.
// actual Reminders lists) first. With ICLOUD_CALDAV_LIST_NAME unset,
// defaults to the first list found, which for most accounts is the same
// "Reminders" default list Siri writes to.
async function findRemindersLists(client: DAVClient): Promise<DAVCalendar[]> {
  const calendars = await client.fetchCalendars()
  const todoLists = calendars.filter((cal) => !cal.components || cal.components.includes('VTODO'))

  const listNames = configuredListNames()
  if (listNames) {
    return listNames.map((name) => {
      const match = todoLists.find((cal) => cal.displayName === name)
      if (!match) throw new Error(`No Reminders list named "${name}" found`)
      return match
    })
  }

  if (todoLists.length === 0) throw new Error('No Reminders (VTODO) list found on this iCloud account')
  return [todoLists[0]]
}

function icsTextOf(object: DAVCalendarObject): string | null {
  return typeof object.data === 'string' && object.data.includes('BEGIN:VTODO') ? object.data : null
}

// Every VTODO currently in the configured list(s), parsed and merged into
// one flat pool — no per-list tagging, callers can't tell which list a
// reminder came from. completedAtNow is threaded through to parseVTodos
// for the rare "STATUS:COMPLETED with no COMPLETED timestamp" case — see
// that function's own comment.
export async function fetchReminders(completedAtNow: string) {
  const client = await getClient()
  const lists = await findRemindersLists(client)

  const results = []
  for (const list of lists) {
    const objects = await client.fetchCalendarObjects({ calendar: list })
    results.push(
      ...objects
        .map((object) => icsTextOf(object))
        .filter((ics): ics is string => ics !== null)
        .flatMap((ics) => parseVTodos(ics, completedAtNow))
    )
  }
  return results
}

// Flips one reminder's completion state by UID — re-fetches the configured
// list(s) to find it (simpler than also storing tsdav's own object URL
// alongside caldav_uid just for this, and each list is small), then PUTs
// the modified VTODO back to whichever list it turned up in. Throws if the
// reminder is gone from every configured list (e.g. deleted on the
// Reminders side since the last pull) — the caller surfaces that as a
// failed push rather than silently no-op'ing.
export async function pushCompletion(caldavUid: string, completed: boolean, nowIso: string): Promise<void> {
  const client = await getClient()
  const lists = await findRemindersLists(client)

  let targetIcs: string | null = null
  let targetObject: DAVCalendarObject | null = null

  for (const list of lists) {
    const objects = await client.fetchCalendarObjects({ calendar: list })
    for (const object of objects) {
      const ics = icsTextOf(object)
      if (!ics) continue
      const [parsed] = parseVTodos(ics, nowIso)
      if (parsed?.caldav_uid === caldavUid) {
        targetIcs = ics
        targetObject = object
        break
      }
    }
    if (targetIcs) break
  }

  if (!targetIcs || !targetObject) {
    throw new Error('Could not find that reminder in Reminders — it may have been deleted there.')
  }

  const updatedIcs = setVTodoCompletion(targetIcs, completed, nowIso)

  await client.updateCalendarObject({
    calendarObject: { ...targetObject, data: updatedIcs },
  })
}
