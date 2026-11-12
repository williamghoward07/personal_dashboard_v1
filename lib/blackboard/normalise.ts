// Raw extension snapshot (client.ts → BbSnapshot) → rows for the bb_* tables
// (docs/specs/blackboard-sync-spec.md §5). Pure: no Next, Supabase or
// server-only imports, so it's testable and could run in the extension too.
//
// The output is the jsonb payload of the bb_sync_apply RPC. `scopes` says,
// per table, which courses were read cleanly: only those may have rows
// marked removed. A section that errored on Blackboard leaves its existing
// rows untouched instead of "removing" them.

import {
  BB_ORIGIN,
  absoluteUrl,
  courseOutlineUrl,
  parseCourseCode,
  todoItemKey,
  type BbContentNode,
  type BbCourseSnapshot,
  type BbJson,
  type BbSnapshot,
} from './client'
import { classifyLink, cleanText, dedupeLinks, extractLinks, htmlToText, safeHref, type BbContentLink } from './links'

export const SYNC_TRIGGERS = ['manual', 'visit', 'daily'] as const
export type BbSyncTrigger = (typeof SYNC_TRIGGERS)[number]

export type BbAssignmentStatus = 'not_submitted' | 'submitted' | 'graded'

export interface BbCourseRow {
  bb_id: string
  course_code: string
  module_code: string | null
  name: string
  term: string | null
  url: string
}

export interface BbAssignmentRow {
  bb_id: string
  course_bb_id: string
  title: string
  due_at: string | null
  bb_content_id: string | null
  status: BbAssignmentStatus
  /** From the To Do item's `column.isFormative`; null = Blackboard didn't say. */
  is_formative: boolean | null
  url: string
}

export interface BbGradeRow {
  /** The gradebook column id. */
  bb_id: string
  course_bb_id: string
  score: number | null
  possible: number | null
  display_grade: string | null
  feedback: string | null
  released_at: string | null
}

export interface BbAnnouncementRow {
  bb_id: string
  course_bb_id: string
  title: string
  body_text: string | null
  posted_at: string | null
  url: string
}

export type BbContentKind = 'folder' | 'document' | 'link' | 'file' | 'assignment' | 'lesson' | 'discussion' | 'tool' | 'other'

export interface BbContentRow {
  bb_id: string
  course_bb_id: string
  parent_bb_id: string | null
  title: string
  kind: BbContentKind
  available_from: string | null
  path: string[]
  week_label: number | null
  url: string
  /** Plain text of the item's description + body, at most MAX_TEXT; null when empty. */
  body_text: string | null
  /** Embedded links and the item's own file / link / Talis / Panopto target. Not the raw item's API `links`. */
  links: BbContentLink[]
}

export interface BbSyncRows {
  started_at: string
  trigger: BbSyncTrigger
  courses: BbCourseRow[]
  assignments: BbAssignmentRow[]
  grades: BbGradeRow[]
  announcements: BbAnnouncementRow[]
  content: BbContentRow[]
  /** Course bb_ids whose section was read without errors, per table. */
  scopes: {
    assignments: string[]
    /** The To Do feed's full range; assignments due outside it are never marked removed. */
    assignment_window: { since: string; until: string } | null
    grades: string[]
    announcements: string[]
    content: string[]
  }
  /** Items dropped because their course isn't in the snapshot. */
  skipped: { assignments: number }
  errors: string[]
}

/** Longest text kept for an announcement body or grade feedback. */
export const MAX_TEXT = 20_000
const MAX_TITLE = 500

// ---------------------------------------------------------------- helpers --

function str(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function obj(value: unknown): BbJson {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as BbJson) : {}
}

/** A valid timestamp as ISO, else null (so the RPC's timestamptz cast can't fail). */
export function toIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function title(value: unknown, fallback: string): string {
  const text = cleanText(htmlToText(str(value) ?? ''), MAX_TITLE)
  return text || cleanText(fallback, MAX_TITLE)
}

/** Cut to MAX_TEXT, Postgres-safe (no NUL, no half surrogate pair). */
function clip(text: string | null): string | null {
  return text ? cleanText(text, MAX_TEXT) : null
}

/** Blackboard HTML → plain text with paragraph breaks (defined in links.ts). */
export { htmlToText }

/** Ultra sends rich text either as an HTML string or as `{ rawText, displayText }`. */
function richText(value: unknown): string | null {
  if (typeof value === 'string') return clip(htmlToText(value)) || null
  const o = obj(value)
  const html = str(o.displayText) ?? str(o.rawText)
  return html ? clip(htmlToText(html)) || null : null
}

/**
 * "Week 5", "Wk 5", "week 12 – rivers" → 5 / 5 / 12. The first number wins
 * ("Weeks 3 & 4" → 3, "Weeks 13-15: …" → 13, "Weeks 18–19" → 18). Durham
 * labels are university week numbers; they are stored as written.
 */
export function parseWeekLabel(text: string): number | null {
  const match = /\b(?:weeks?|wks?)\.?\s*(\d{1,2})\b/i.exec(text)
  return match ? Number(match[1]) : null
}

const KIND_BY_HANDLER: Record<string, BbContentKind> = {
  'resource/x-bb-folder': 'folder',
  'resource/x-bb-lesson': 'lesson',
  'resource/x-bb-document': 'document',
  'resource/x-bb-file': 'file',
  'resource/x-bb-externallink': 'link',
  'resource/x-bb-assignment': 'assignment',
  'resource/x-bb-asmt-test-link': 'assignment',
  'resource/x-bb-asmt-survey-link': 'assignment',
  'resource/x-turnitin-assignment': 'assignment',
  'resource/x-bb-forumlink': 'discussion',
  'resource/x-bb-discussion-topic': 'discussion',
  'resource/x-bb-blti-link': 'tool',
  'resource/x-bb-toollink': 'tool',
}

/**
 * `contentHandler.id` → kind. Unknown handlers are `other`.
 * - `x-bb-blti-link` with a `grading` block (or a Turnitin URL) is a
 *   submission point, so `assignment`; other LTI links are `tool`.
 * - `x-bb-bltiplacement-*` (Talis reading list, Panopto recordings) is `tool`.
 * - `x-bb-courselink` follows its `targetType` (discussion boards and
 *   submission points), else it's a `link` within the course.
 */
export function contentKind(item: BbJson): BbContentKind {
  const handlerObj = obj(item.contentHandler)
  const handler = str(handlerObj.id)
  if (!handler) return 'other'
  if (handler === 'resource/x-bb-blti-link') {
    const gradable = Object.keys(obj(handlerObj.grading)).length > 0
    return gradable || /turnitin/i.test(str(handlerObj.url) ?? '') ? 'assignment' : 'tool'
  }
  if (handler.startsWith('resource/x-bb-bltiplacement-')) return 'tool'
  if (handler === 'resource/x-bb-courselink') {
    const target = str(handlerObj.targetType) ?? ''
    if (/discussion|forum/i.test(target)) return 'discussion'
    if (/assess|assignment|test|survey/i.test(target)) return 'assignment'
    return 'link'
  }
  return KIND_BY_HANDLER[handler] ?? (handler.includes('turnitin') ? 'assignment' : 'other')
}

/** The item's own Ultra link from `links`, else the course outline. */
function contentUrl(item: BbJson, courseBbId: string): string {
  const links = Array.isArray(item.links) ? (item.links as unknown[]).map(obj) : []
  const link = links.find((l) => l.type === 'text/html' && str(l.href)) ?? links.find((l) => str(l.href))
  const href = link ? str(link.href) : null
  if (href) {
    try {
      const url = new URL(absoluteUrl(href))
      if (url.origin === BB_ORIGIN) return url.toString()
    } catch {
      // fall through to the course page
    }
  }
  return courseOutlineUrl(courseBbId)
}

// -------------------------------------------------------- course sections --

/** Section errors are recorded by client.ts as `<section>: <message>` (`contents <id>: …` inside the tree walk). */
function sectionFailed(course: BbCourseSnapshot, section: 'columns' | 'grades' | 'announcements' | 'contents'): boolean {
  return course.errors.some((e) => e === section || e.startsWith(`${section}:`) || e.startsWith(`${section} `))
}

function courseRow(course: BbCourseSnapshot): BbCourseRow {
  const { moduleCode, year } = parseCourseCode(course.courseCode)
  return {
    bb_id: course.bbId,
    course_code: course.courseCode,
    module_code: moduleCode,
    name: title(course.name, course.courseCode),
    term: year ? String(year) : null,
    url: courseOutlineUrl(course.bbId),
  }
}

/** An item's `body` / `description`: an HTML string or `{ rawText, displayText }`. */
function rawHtml(value: unknown): string {
  if (typeof value === 'string') return value
  const o = obj(value)
  return str(o.displayText) ?? str(o.rawText) ?? ''
}

/** Description first, then body; empty and repeated parts are skipped. */
function contentBodyText(htmlParts: string[]): string | null {
  const parts: string[] = []
  for (const html of htmlParts) {
    const text = htmlToText(html)
    if (text && !parts.includes(text)) parts.push(text)
  }
  return clip(parts.join('\n\n'))
}

/**
 * The item's own target, from its content handler. Files point at the item
 * (never a download URL); LTI placements are never launched or resolved, so
 * they also point at the item.
 */
function handlerLinks(item: BbJson, name: string, itemUrl: string): BbContentLink[] {
  const handler = obj(item.contentHandler)
  const id = str(handler.id) ?? ''
  if (id === 'resource/x-bb-externallink') {
    const href = safeHref(str(handler.url) ?? '', itemUrl)
    return href ? [{ href, label: name, kind: classifyLink(href, name) }] : []
  }
  if (id === 'resource/x-bb-file') {
    const file = obj(handler.file)
    const fileName = (str(file.fileName) ?? '').trim()
    const mime = (str(file.mimeType) ?? '').trim()
    const kind = classifyLink(itemUrl, fileName || name, mime || undefined) === 'slides' ? 'slides' : 'file'
    const link: BbContentLink = { href: itemUrl, label: cleanText(fileName || name, 300), kind }
    if (mime) link.mime = cleanText(mime, 300)
    return [link]
  }
  if (id.includes('lti-talis')) return [{ href: itemUrl, label: name, kind: 'talis' }]
  if (/panopto/i.test(id)) return [{ href: itemUrl, label: name, kind: 'panopto' }]
  return []
}

function contentRows(course: BbCourseSnapshot): BbContentRow[] {
  return course.contents.map((item: BbContentNode) => {
    const name = title(item.title, 'Untitled')
    const path = item.path.map((p) => cleanText(htmlToText(p), MAX_TITLE))
    let week = parseWeekLabel(name)
    for (let i = path.length - 1; week === null && i >= 0; i--) week = parseWeekLabel(path[i])
    const url = contentUrl(item, course.bbId)
    // `item.links` is Blackboard's own API link list (used for `url` above), not embedded links.
    const html = [rawHtml(item.description), rawHtml(item.body)]
    return {
      bb_id: item.id,
      course_bb_id: course.bbId,
      parent_bb_id: str(item.parentId),
      title: name,
      kind: contentKind(item),
      available_from: toIso(obj(obj(item.availability).adaptiveRelease).start),
      path,
      week_label: week,
      url,
      body_text: contentBodyText(html),
      links: dedupeLinks([...handlerLinks(item, name, url), ...html.flatMap((h) => extractLinks(h, url))]),
    }
  })
}

function announcementRows(course: BbCourseSnapshot): BbAnnouncementRow[] {
  const rows: BbAnnouncementRow[] = []
  for (const a of course.announcements) {
    const id = str(a.id)
    if (!id) continue
    const duration = obj(obj(a.availability).duration)
    rows.push({
      bb_id: id,
      course_bb_id: course.bbId,
      title: title(a.title, 'Announcement'),
      body_text: richText(a.body),
      posted_at: toIso(duration.start) ?? toIso(a.created),
      url: `${BB_ORIGIN}/ultra/courses/${encodeURIComponent(course.bbId)}/announcements`,
    })
  }
  return rows
}

function formatGrade(display: BbJson, score: number | null, possible: number | null): string | null {
  const text = str(display.text)
  if (text) return text
  if (score === null) return null
  if (display.scaleType === 'Percent') return `${score}%`
  return possible !== null ? `${score}/${possible}` : String(score)
}

function gradeRows(course: BbCourseSnapshot): BbGradeRow[] {
  const possibleByColumn = new Map(course.columns.map((c) => [str(c.id), num(obj(c.score).possible)]))
  const rows: BbGradeRow[] = []
  for (const g of course.grades) {
    const columnId = str(g.columnId)
    if (!columnId) continue
    const display = obj(g.displayGrade)
    const score = num(display.score) ?? num(g.score)
    const possible = num(display.possible) ?? possibleByColumn.get(columnId) ?? null
    rows.push({
      bb_id: columnId,
      course_bb_id: course.bbId,
      score,
      possible,
      display_grade: clip(formatGrade(display, score, possible) ?? (str(g.text) || null)),
      feedback: richText(g.feedback),
      released_at: toIso(g.lastRelevantDate) ?? toIso(g.firstRelevantDate),
    })
  }
  return rows
}

function gradeStatus(grade: BbJson | undefined): BbAssignmentStatus {
  if (!grade) return 'not_submitted'
  if (grade.status === 'Graded') return 'graded'
  if (grade.status === 'NeedsGrading') return 'submitted'
  return 'not_submitted'
}

/** A gradebook column that is a piece of coursework: tied to content or due, and not a calculated total. */
function isCourseworkColumn(column: BbJson): boolean {
  const grading = obj(column.grading)
  if (grading.type === 'Calculated' || column.externalGrade === true) return false
  return str(column.contentId) !== null || toIso(grading.due) !== null
}

/**
 * `column.isFormative` on a To Do item, when it's a boolean. UNVERIFIED: the
 * To Do feed was empty during the live audit, so the field's presence and
 * name are a guess; anything else (missing, string, null) is "unknown".
 */
function formativeFlag(todoItem: BbJson): boolean | null {
  const flag = obj(todoItem.column).isFormative
  return typeof flag === 'boolean' ? flag : null
}

const TODO_BUCKETS = ['overdueItems', 'dueTodayItems', 'futureDueItems'] as const

// ------------------------------------------------------------------ main --

/**
 * Snapshot → table rows. Assignments merge two sources: the To Do feed
 * (primary for due dates, and the only place Turnitin/external work shows
 * up) and the gradebook's coursework columns (covers work outside the To Do
 * window). Both are keyed by todoItemKey, so a column seen in both is one row.
 */
export function normaliseSnapshot(snap: BbSnapshot, trigger: BbSyncTrigger = 'manual'): BbSyncRows {
  const courses = snap.courses.map(courseRow)
  const content = snap.courses.flatMap(contentRows)
  const announcements = snap.courses.flatMap(announcementRows)
  const grades = snap.courses.flatMap(gradeRows)

  // A To Do item's column.courseId may be the internal id or the course code.
  const courseByRef = new Map<string, BbCourseSnapshot>()
  for (const c of snap.courses) {
    courseByRef.set(c.bbId, c)
    courseByRef.set(c.courseCode, c)
  }
  const gradeByColumn = new Map<string, BbJson>()
  const contentUrlById = new Map<string, string>()
  for (const c of snap.courses) {
    for (const g of c.grades) if (str(g.columnId)) gradeByColumn.set(str(g.columnId)!, g)
  }
  for (const row of content) contentUrlById.set(row.bb_id, row.url)

  const assignments = new Map<string, BbAssignmentRow>()
  const assignmentRow = (
    key: string,
    course: BbCourseSnapshot,
    columnId: string | null,
    contentId: string | null,
    name: string,
    due: string | null,
    isFormative: boolean | null = null,
  ): BbAssignmentRow => ({
    bb_id: key,
    course_bb_id: course.bbId,
    title: name,
    due_at: due,
    bb_content_id: contentId,
    status: gradeStatus(columnId ? gradeByColumn.get(columnId) : undefined),
    is_formative: isFormative,
    url: (contentId && contentUrlById.get(contentId)) || courseOutlineUrl(course.bbId),
  })

  for (const course of snap.courses) {
    for (const column of course.columns) {
      if (!isCourseworkColumn(column)) continue
      const columnId = str(column.id)
      if (!columnId) continue
      const contentId = str(column.contentId)
      const key = todoItemKey({ column: { id: columnId, contentId } })
      assignments.set(
        key,
        assignmentRow(key, course, columnId, contentId, title(column.name, 'Coursework'), toIso(obj(column.grading).due)),
      )
    }
  }

  let skippedTodo = 0
  const seenTodo = new Set<string>()
  for (const window of snap.todo) {
    for (const bucket of TODO_BUCKETS) {
      const items = window.body[bucket]
      if (!Array.isArray(items)) continue
      for (const raw of items) {
        const item = obj(raw)
        const key = todoItemKey(item)
        if (seenTodo.has(key)) continue // windows overlap at their edges
        seenTodo.add(key)
        const column = obj(item.column)
        const course = courseByRef.get(str(column.courseId) ?? '')
        if (!course) {
          skippedTodo++
          continue
        }
        const fromColumn = assignments.get(key)
        const contentId = str(column.contentId) ?? fromColumn?.bb_content_id ?? null
        assignments.set(
          key,
          assignmentRow(
            key,
            course,
            str(column.id),
            contentId,
            title(item.title, fromColumn?.title ?? str(column.name) ?? 'Coursework'),
            toIso(item.dueDate) ?? fromColumn?.due_at ?? null,
            formativeFlag(item) ?? fromColumn?.is_formative ?? null,
          ),
        )
      }
    }
  }

  // The To Do range is only trustworthy if every window came back.
  const todoFailed = snap.errors.some((e) => e.startsWith('todo'))
  const since = snap.todo.map((w) => w.since).sort()[0]
  const until = snap.todo.map((w) => w.until).sort().at(-1)
  const window = !todoFailed && since && until ? { since, until } : null
  const clean = (section: Parameters<typeof sectionFailed>[1], extra: (c: BbCourseSnapshot) => boolean = () => true) =>
    snap.courses.filter((c) => !sectionFailed(c, section) && extra(c)).map((c) => c.bbId)

  return {
    started_at: toIso(snap.fetchedAt) ?? new Date().toISOString(),
    trigger,
    courses: dedupe(courses),
    assignments: [...assignments.values()],
    grades: dedupe(grades),
    announcements: dedupe(announcements),
    content: dedupe(content),
    scopes: {
      assignments: window ? clean('columns') : [],
      assignment_window: window,
      grades: clean('grades'),
      announcements: clean('announcements'),
      // Folders left unopened (depth/item cap) mean the tree is incomplete.
      content: clean('contents', (c) => c.skippedFolders === 0),
    },
    skipped: { assignments: skippedTodo },
    errors: [...snap.errors, ...snap.courses.flatMap((c) => c.errors.map((e) => `${c.courseCode} ${e}`))],
  }
}

/** One row per bb_id (last wins): Postgres rejects an upsert that hits the same key twice. */
function dedupe<T extends { bb_id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.bb_id, row])).values()]
}

// ------------------------------------------------------------ validation --

/** Upper bounds well above a real sync (10 courses, ~550 items), to reject junk. */
export const SYNC_LIMITS = { courses: 100, itemsPerCourse: 5000, todoWindows: 50 } as const

function isObj(value: unknown): value is BbJson {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isObjArray(value: unknown, max: number): value is BbJson[] {
  return Array.isArray(value) && value.length <= max && value.every(isObj)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isCourse(value: unknown): value is BbCourseSnapshot {
  if (!isObj(value)) return false
  const max = SYNC_LIMITS.itemsPerCourse
  return (
    typeof value.bbId === 'string' &&
    value.bbId !== '' &&
    typeof value.courseCode === 'string' &&
    typeof value.name === 'string' &&
    isObjArray(value.columns, max) &&
    isObjArray(value.grades, max) &&
    isObjArray(value.announcements, max) &&
    isObjArray(value.contents, max) &&
    value.contents.every((c) => typeof c.id === 'string' && isStringArray(c.path)) &&
    typeof value.skippedFolders === 'number' &&
    isStringArray(value.errors)
  )
}

/**
 * The extension's POST body: `{ trigger?, snapshot }`. Checks the structure
 * the normaliser relies on; the Blackboard objects inside stay loosely typed
 * and are read defensively.
 */
export function parseSyncBody(body: unknown): { trigger: BbSyncTrigger; snapshot: BbSnapshot } | null {
  if (!isObj(body)) return null
  const trigger = body.trigger ?? 'manual'
  if (!SYNC_TRIGGERS.includes(trigger as BbSyncTrigger)) return null
  const snap = body.snapshot
  if (!isObj(snap)) return null
  if (snap.version !== 1 || snap.origin !== BB_ORIGIN || toIso(snap.fetchedAt) === null) return null
  if (!isObj(snap.user) || typeof snap.user.id !== 'string') return null
  if (!Array.isArray(snap.courses) || snap.courses.length > SYNC_LIMITS.courses || !snap.courses.every(isCourse)) return null
  if (
    !isObjArray(snap.todo, SYNC_LIMITS.todoWindows) ||
    !snap.todo.every((w) => toIso(w.since) !== null && toIso(w.until) !== null && isObj(w.body))
  ) {
    return null
  }
  if (!isStringArray(snap.errors)) return null
  return { trigger: trigger as BbSyncTrigger, snapshot: snap as unknown as BbSnapshot }
}
