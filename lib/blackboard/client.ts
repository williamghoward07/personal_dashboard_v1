// Read-only client for Blackboard Ultra's JSON API (docs/specs/blackboard-sync-spec.md).
//
// It runs inside my logged-in browser (the Chrome extension in extension/),
// so every request rides Blackboard's own session cookie. No password, 2FA
// or OAuth token is ever handled here. GET only: nothing on Blackboard is
// changed. The fetch function is injected so this stays pure and testable.

export const BB_ORIGIN = 'https://blackboard.durham.ac.uk'

/** Durham's To Do feed rejects windows of 28 days; 14 is what the Ultra UI asks for. */
export const TODO_WINDOW_DAYS = 14

export interface BbResponse {
  status: number
  /** Final URL after redirects. A different origin means we were sent to SSO. */
  url: string
  /** Parsed JSON, or null when the response wasn't JSON. */
  body: unknown
}

export type BbFetch = (url: string) => Promise<BbResponse>

export class BbLoginRequiredError extends Error {
  constructor(readonly reason: string) {
    super(`Blackboard login required (${reason})`)
    this.name = 'BbLoginRequiredError'
  }
}

export class BbHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Blackboard returned ${status} for ${path}`)
    this.name = 'BbHttpError'
  }
}

export type BbJson = Record<string, unknown>

interface BbPage<T> {
  results?: T[]
  paging?: { nextPage?: string }
}

/**
 * Resolve against the Blackboard origin. The Ultra page sets `<base href>` to
 * a CloudFront CDN, so relative URLs (and `paging.nextPage`, which is
 * relative) would otherwise hit the CDN and 404.
 */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, BB_ORIGIN).toString()
}

export async function getJson<T>(fetchFn: BbFetch, path: string): Promise<T> {
  const res = await fetchFn(absoluteUrl(path))
  const finalOrigin = safeOrigin(res.url)
  if (finalOrigin !== BB_ORIGIN) throw new BbLoginRequiredError(`redirected to ${finalOrigin ?? 'unknown host'}`)
  if (res.status === 401) throw new BbLoginRequiredError('401')
  if (res.status !== 200) throw new BbHttpError(res.status, path)
  // A 200 that isn't JSON is the login page served on Blackboard's own origin.
  if (res.body === null || typeof res.body !== 'object') throw new BbLoginRequiredError('non-JSON response')
  return res.body as T
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Follows `paging.nextPage` (empty string when there are no more pages). */
export async function getAllPages<T>(fetchFn: BbFetch, path: string, maxPages = 20): Promise<T[]> {
  const out: T[] = []
  let next: string | undefined = path
  for (let page = 0; next && page < maxPages; page++) {
    const body: BbPage<T> = await getJson<BbPage<T>>(fetchFn, next)
    out.push(...(body.results ?? []))
    next = body.paging?.nextPage || undefined
  }
  return out
}

/** `GEOG1241_2026` → GEOG1241 / 2026. Org courses (`X_SCI_2026`) have no module code. */
export function parseCourseCode(courseId: string): { moduleCode: string | null; year: number | null } {
  const year = /_(\d{4})$/.exec(courseId)
  const code = /^([A-Z]{4}\d{4})_\d{4}$/.exec(courseId)
  return { moduleCode: code ? code[1] : null, year: year ? Number(year[1]) : null }
}

/** Splits [from, to) into consecutive windows of at most `days` days. */
export function todoWindows(from: Date, to: Date, days = TODO_WINDOW_DAYS): { since: string; until: string }[] {
  const out: { since: string; until: string }[] = []
  const step = days * 86_400_000
  for (let start = from.getTime(); start < to.getTime(); start += step) {
    const end = Math.min(start + step, to.getTime())
    out.push({ since: new Date(start).toISOString(), until: new Date(end).toISOString() })
  }
  return out
}

export interface BbContentNode extends BbJson {
  id: string
  /** 0 = top level of the course. */
  depth: number
  /** Titles of the folders above this item. */
  path: string[]
}

export interface ContentTreeResult {
  items: BbContentNode[]
  /** Folders not opened because of the depth or item cap. */
  skippedFolders: number
  errors: string[]
}

/** Breadth-first walk of a course's content, opening folders and lessons with `hasChildren`. */
export async function getContentTree(
  fetchFn: BbFetch,
  courseId: string,
  { maxDepth = 4, maxItems = 1000 }: { maxDepth?: number; maxItems?: number } = {},
): Promise<ContentTreeResult> {
  const base = `/learn/api/public/v1/courses/${encodeURIComponent(courseId)}/contents`
  const items: BbContentNode[] = []
  const errors: string[] = []
  let skippedFolders = 0
  const queue: { parentId: string | null; depth: number; path: string[] }[] = [{ parentId: null, depth: 0, path: [] }]

  while (queue.length > 0) {
    if (items.length >= maxItems) {
      skippedFolders += queue.length
      break
    }
    const { parentId, depth, path } = queue.shift()!
    const url = parentId ? `${base}/${encodeURIComponent(parentId)}/children?limit=100` : `${base}?limit=100`
    let children: BbJson[]
    try {
      children = await getAllPages<BbJson>(fetchFn, url)
    } catch (err) {
      if (err instanceof BbLoginRequiredError) throw err
      errors.push(`contents ${parentId ?? 'root'}: ${errorMessage(err)}`)
      continue
    }
    for (const child of children) {
      if (items.length >= maxItems) break
      const id = String(child.id)
      items.push({ ...child, id, depth, path })
      if (child.hasChildren !== true) continue
      if (depth + 1 >= maxDepth) skippedFolders++
      else queue.push({ parentId: id, depth: depth + 1, path: [...path, String(child.title ?? '')] })
    }
  }
  return { items, skippedFolders, errors }
}

export interface BbCourseSnapshot {
  /** Blackboard's internal id, e.g. `_123456_1`. */
  bbId: string
  courseCode: string
  moduleCode: string | null
  name: string
  membership: BbJson
  course: BbJson
  columns: BbJson[]
  grades: BbJson[]
  announcements: BbJson[]
  contents: BbContentNode[]
  skippedFolders: number
  errors: string[]
}

export interface BbSnapshot {
  version: 1
  origin: string
  fetchedAt: string
  user: { id: string; userName: string }
  courses: BbCourseSnapshot[]
  todo: { since: string; until: string; body: BbJson }[]
  errors: string[]
  requestCount: number
  durationMs: number
}

/** The snapshot's stages, in order. The side panel draws one roadmap circle per stage (plus "saved"). */
export const SNAPSHOT_STAGES = ['session', 'courses', 'content', 'todo'] as const
export type SnapshotStage = (typeof SNAPSHOT_STAGES)[number]

export interface SnapshotProgress {
  stage: SnapshotStage
  /** 1-based, during `content`. */
  courseIndex?: number
  courseCount?: number
  courseCode?: string
  /** 1-based, during `todo`. */
  windowIndex?: number
  windowCount?: number
  requestCount: number
}

export interface SnapshotOptions {
  now?: Date
  todoPastDays?: number
  todoFutureDays?: number
  /** Pause between requests, to stay gentle on Blackboard. */
  delayMs?: number
  maxContentDepth?: number
  maxContentItems?: number
  onProgress?: (progress: SnapshotProgress) => void
  sleep?: (ms: number) => Promise<void>
}

/** One request: is the session alive? Also the side panel's "connected" check. */
export async function getMe(fetchFn: BbFetch): Promise<{ id: string; userName: string }> {
  try {
    const me = await getJson<BbJson>(fetchFn, '/learn/api/public/v1/users/me')
    return { id: String(me.id), userName: String(me.userName ?? '') }
  } catch (err) {
    // An expired session can also come back as a 403 on /users/me.
    if (err instanceof BbHttpError && err.status === 403) throw new BbLoginRequiredError('403')
    throw err
  }
}

/**
 * Everything the sync needs, raw. Throws BbLoginRequiredError if the session
 * is gone at any point: a partial snapshot must never be synced, or the server
 * would mark everything missing as removed.
 */
export async function snapshot(rawFetch: BbFetch, options: SnapshotOptions = {}): Promise<BbSnapshot> {
  const {
    now = new Date(),
    todoPastDays = 14,
    todoFutureDays = 84,
    delayMs = 150,
    maxContentDepth,
    maxContentItems,
    onProgress = () => {},
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options
  const started = Date.now()
  let requestCount = 0
  const fetchFn: BbFetch = async (url) => {
    if (requestCount > 0 && delayMs > 0) await sleep(delayMs)
    requestCount++
    return rawFetch(url)
  }

  const progress = (p: Omit<SnapshotProgress, 'requestCount'>) => onProgress({ ...p, requestCount })

  progress({ stage: 'session' })
  const me = await getMe(fetchFn)
  const userId = me.id

  progress({ stage: 'courses' })
  const memberships = await getAllPages<BbJson>(
    fetchFn,
    `/learn/api/v1/users/${encodeURIComponent(userId)}/memberships?expand=course&limit=100`,
  )
  const current = memberships.filter((m) => {
    const course = m.course as BbJson | undefined
    return course && course.isClosed !== true && m.isAvailable !== false
  })

  const errors: string[] = []
  const courses: BbCourseSnapshot[] = []
  for (const [index, membership] of current.entries()) {
    const course = membership.course as BbJson
    const bbId = String(course.id)
    const courseCode = String(course.courseId ?? bbId)
    progress({ stage: 'content', courseIndex: index + 1, courseCount: current.length, courseCode })
    const courseErrors: string[] = []
    const section = async <T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await load()
      } catch (err) {
        if (err instanceof BbLoginRequiredError) throw err
        courseErrors.push(`${label}: ${errorMessage(err)}`)
        return fallback
      }
    }
    const id = encodeURIComponent(bbId)
    const columns = await section(
      'columns',
      () => getAllPages<BbJson>(fetchFn, `/learn/api/public/v2/courses/${id}/gradebook/columns?limit=100`),
      [],
    )
    const grades = await section(
      'grades',
      () =>
        getAllPages<BbJson>(
          fetchFn,
          `/learn/api/public/v2/courses/${id}/gradebook/users/${encodeURIComponent(userId)}?limit=100`,
        ),
      [],
    )
    const announcements = await section(
      'announcements',
      () => getAllPages<BbJson>(fetchFn, `/learn/api/public/v1/courses/${id}/announcements?limit=100`),
      [],
    )
    const tree = await section(
      'contents',
      () => getContentTree(fetchFn, bbId, { maxDepth: maxContentDepth, maxItems: maxContentItems }),
      { items: [], skippedFolders: 0, errors: [] } as ContentTreeResult,
    )
    courses.push({
      bbId,
      courseCode,
      moduleCode: parseCourseCode(courseCode).moduleCode,
      name: String(course.name ?? course.displayName ?? courseCode),
      membership: withoutCourse(membership),
      course,
      columns,
      grades,
      announcements,
      contents: tree.items,
      skippedFolders: tree.skippedFolders,
      errors: [...courseErrors, ...tree.errors],
    })
  }

  const from = new Date(now.getTime() - todoPastDays * 86_400_000)
  const to = new Date(now.getTime() + todoFutureDays * 86_400_000)
  const todo: BbSnapshot['todo'] = []
  const windows = todoWindows(from, to)
  for (const [index, window] of windows.entries()) {
    progress({ stage: 'todo', windowIndex: index + 1, windowCount: windows.length })
    const query = `since=${encodeURIComponent(window.since)}&until=${encodeURIComponent(window.until)}`
    try {
      todo.push({ ...window, body: await getJson<BbJson>(fetchFn, `/learn/api/v1/calendars/todo/studentItems?${query}`) })
    } catch (err) {
      if (err instanceof BbLoginRequiredError) throw err
      errors.push(`todo ${window.since}: ${errorMessage(err)}`)
    }
  }

  return {
    version: 1,
    origin: BB_ORIGIN,
    fetchedAt: now.toISOString(),
    // Only what identifies the account; the rest of the profile isn't needed.
    user: me,
    courses,
    todo,
    errors,
    requestCount,
    durationMs: Date.now() - started,
  }
}

function withoutCourse(membership: BbJson): BbJson {
  const { course: _course, ...rest } = membership
  void _course
  return rest
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const TODO_BUCKETS = ['overdueItems', 'dueTodayItems', 'futureDueItems'] as const

export interface SnapshotSummary {
  fetchedAt: string
  courses: {
    bbId: string
    name: string
    courseCode: string
    moduleCode: string | null
    columns: number
    grades: number
    announcements: number
    contents: number
    skippedFolders: number
    errors: number
  }[]
  /** Distinct To Do items across all windows (windows overlap at their edges). */
  todoItems: number
  errors: number
  requestCount: number
  durationMs: number
}

/**
 * To Do items have no id of their own: `{ title, dueDate, column, contentVisibility }`.
 * The gradebook column identifies the piece of coursework.
 */
export function todoItemKey(item: BbJson): string {
  const column = (item.column ?? {}) as BbJson
  if (column.id != null) return `column:${String(column.id)}`
  if (column.contentId != null) return `content:${String(column.contentId)}`
  return `title:${String(item.title ?? '')}|${String(item.dueDate ?? '')}`
}

export function summariseSnapshot(snap: BbSnapshot): SnapshotSummary {
  const todoKeys = new Set<string>()
  for (const window of snap.todo) {
    for (const bucket of TODO_BUCKETS) {
      const items = window.body[bucket]
      if (!Array.isArray(items)) continue
      for (const item of items as BbJson[]) if (item) todoKeys.add(todoItemKey(item))
    }
  }
  return {
    fetchedAt: snap.fetchedAt,
    courses: snap.courses.map((c) => ({
      bbId: c.bbId,
      name: c.name,
      courseCode: c.courseCode,
      moduleCode: c.moduleCode,
      columns: c.columns.length,
      grades: c.grades.length,
      announcements: c.announcements.length,
      contents: c.contents.length,
      skippedFolders: c.skippedFolders,
      errors: c.errors.length,
    })),
    todoItems: todoKeys.size,
    errors: snap.errors.length + snap.courses.reduce((n, c) => n + c.errors.length, 0),
    requestCount: snap.requestCount,
    durationMs: snap.durationMs,
  }
}
