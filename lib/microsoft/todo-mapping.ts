// Pure mapping between Microsoft To Do tasks (Graph `todoTask`) and this
// app's todos rows. No network — see lib/microsoft/todo.ts for the client.

export const APP_TIMEZONE = 'Europe/London'

// Old finished tasks stay in To Do forever; only recent ones are worth
// pulling in (an already-linked todo is still updated regardless).
export const COMPLETED_IMPORT_WINDOW_DAYS = 30

export interface GraphDateTime {
  dateTime: string
  timeZone: string
}

export interface GraphTodoList {
  id: string
  displayName: string
  wellknownListName?: 'none' | 'defaultList' | 'flaggedEmails' | 'unknownFutureValue' | string
}

export interface GraphTodoTask {
  id: string
  title: string
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred' | string
  importance: 'low' | 'normal' | 'high' | string
  body?: { content?: string; contentType?: 'text' | 'html' | string } | null
  dueDateTime?: GraphDateTime | null
  reminderDateTime?: GraphDateTime | null
  isReminderOn?: boolean
  completedDateTime?: GraphDateTime | null
  /** Present when tasks are listed with $expand=checklistItems. */
  checklistItems?: GraphChecklistItem[]
}

/** A To Do "step" — mirrored as an app subtask (todos.parent_id). */
export interface GraphChecklistItem {
  id: string
  displayName: string
  isChecked: boolean
  checkedDateTime?: string | null
}

export interface MsTodoStepRow {
  title: string
  completed_at: string | null
  mstodo_checklist_item_id: string
}

export interface MsTodoRow {
  title: string
  notes: string | null
  due_date: string | null
  due_time: string | null
  completed_at: string | null
  starred: boolean
  list_id: string | null
  mstodo_task_id: string
  mstodo_list_id: string
  /** null = steps weren't fetched, so leave existing subtasks alone. */
  steps: MsTodoStepRow[] | null
}

// Graph returns dateTime without an offset ("2026-09-17T09:00:00.0000000")
// alongside a timeZone. Requests ask for London time (Prefer header), but
// a "UTC" value is still converted here so either shape works.
function localParts(value: GraphDateTime): { date: string; time: string } | null {
  const match = value.dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, date, hh, mm] = match
  if (value.timeZone.toUpperCase() !== 'UTC') return { date, time: `${hh}:${mm}` }

  const utc = new Date(`${date}T${hh}:${mm}:00Z`)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(utc)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

function toIso(value: GraphDateTime | null | undefined): string | null {
  if (!value) return null
  const match = value.dateTime.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
  if (!match) return null
  // Completion times come back in UTC; anything else is treated as
  // London-local and resolved via localParts' inverse is overkill for a
  // "when was this ticked" stamp, so only the UTC shape is exact.
  return value.timeZone.toUpperCase() === 'UTC' ? `${match[1]}Z` : new Date(match[1]).toISOString()
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export function taskNotes(task: GraphTodoTask): string | null {
  const content = task.body?.content ?? ''
  const text = task.body?.contentType === 'html' ? stripHtml(content) : content.trim()
  return text || null
}

/**
 * One To Do task as a todos row. Due date comes from the task's due date;
 * a reminder ("Remind me at 17:00") supplies the time — and the date too
 * when the task has no due date of its own.
 */
export function mapTaskToRow(
  task: GraphTodoTask,
  mstodoListId: string,
  appListId: string | null,
  nowIso: string
): MsTodoRow {
  const due = task.dueDateTime ? localParts(task.dueDateTime) : null
  const reminder = task.isReminderOn && task.reminderDateTime ? localParts(task.reminderDateTime) : null
  const dueDate = due?.date ?? reminder?.date ?? null
  const dueTime = reminder && (!due || reminder.date === due.date) ? reminder.time : null
  const completed = task.status === 'completed'

  return {
    title: task.title?.trim() || 'Untitled',
    notes: taskNotes(task),
    due_date: dueDate,
    due_time: dueTime,
    completed_at: completed ? (toIso(task.completedDateTime) ?? nowIso) : null,
    starred: task.importance === 'high',
    list_id: appListId,
    mstodo_task_id: task.id,
    mstodo_list_id: mstodoListId,
    steps: task.checklistItems ? task.checklistItems.map((item) => mapStepToRow(item, nowIso)) : null,
  }
}

export function mapStepToRow(item: GraphChecklistItem, nowIso: string): MsTodoStepRow {
  return {
    title: item.displayName?.trim() || 'Untitled',
    completed_at: item.isChecked ? (item.checkedDateTime ?? nowIso) : null,
    mstodo_checklist_item_id: item.id,
  }
}

/** Whether a task should be pulled in: open, or finished recently, or already linked. */
export function shouldImportTask(task: GraphTodoTask, alreadyLinked: boolean, nowIso: string): boolean {
  if (alreadyLinked || task.status !== 'completed') return true
  const completedAt = toIso(task.completedDateTime)
  if (!completedAt) return false
  const ageMs = new Date(nowIso).getTime() - new Date(completedAt).getTime()
  return ageMs <= COMPLETED_IMPORT_WINDOW_DAYS * 86_400_000
}

export interface TodoSyncChanges {
  completed?: boolean
  starred?: boolean
  title?: string
  notes?: string | null
  due_date?: string | null
  /** "HH:mm" — sent as the task's reminder, on its due date. */
  due_time?: string | null
  /** The app list moved; the push route recreates the task in that list. */
  list_id?: string | null
}

/**
 * The reminder half of a task: a time only means something with a date,
 * so no date (or no time) turns the reminder off. Due date + reminder on
 * the same day round-trips through mapTaskToRow unchanged.
 */
export function reminderFields(dueDate: string | null, dueTime: string | null): Record<string, unknown> {
  if (!dueDate || !dueTime) return { isReminderOn: false }
  return {
    isReminderOn: true,
    reminderDateTime: { dateTime: `${dueDate}T${dueTime}:00`, timeZone: APP_TIMEZONE },
  }
}

/** The fields of a todo needed to create its task. */
export interface TaskSource {
  title: string
  notes: string | null
  due_date: string | null
  due_time: string | null
  completed_at: string | null
  starred: boolean
}

/** A Graph `todoTask` create body for an app todo. */
export function todoToTaskBody(todo: TaskSource): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: todo.title,
    importance: todo.starred ? 'high' : 'normal',
    status: todo.completed_at ? 'completed' : 'notStarted',
    ...reminderFields(todo.due_date, todo.due_time),
  }
  if (todo.notes) body.body = { content: todo.notes, contentType: 'text' }
  if (todo.due_date) body.dueDateTime = { dateTime: `${todo.due_date}T00:00:00`, timeZone: APP_TIMEZONE }
  return body
}

/** A subtask's edits as a Graph checklistItem PATCH body. */
export function changesToStepPatch(changes: TodoSyncChanges): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (changes.completed !== undefined) patch.isChecked = changes.completed
  if (changes.title !== undefined) patch.displayName = changes.title
  return patch
}

/**
 * App-side edits as a Graph PATCH body for the linked task. When either
 * due_date or due_time changes, pass both (the push route fills them in
 * from the saved row) so the reminder lands on the right day.
 */
export function changesToGraphPatch(changes: TodoSyncChanges): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (changes.completed !== undefined) patch.status = changes.completed ? 'completed' : 'notStarted'
  if (changes.starred !== undefined) patch.importance = changes.starred ? 'high' : 'normal'
  if (changes.title !== undefined) patch.title = changes.title
  if (changes.notes !== undefined) patch.body = { content: changes.notes ?? '', contentType: 'text' }
  if (changes.due_date !== undefined) {
    patch.dueDateTime = changes.due_date
      ? { dateTime: `${changes.due_date}T00:00:00`, timeZone: APP_TIMEZONE }
      : null
  }
  if (changes.due_time !== undefined || changes.due_date !== undefined) {
    Object.assign(patch, reminderFields(changes.due_date ?? null, changes.due_time ?? null))
  }
  return patch
}

/** To Do lists worth syncing (the auto "Flagged email" list isn't). */
export function syncableLists(lists: GraphTodoList[]): GraphTodoList[] {
  return lists.filter((l) => l.wellknownListName !== 'flaggedEmails')
}

/**
 * Which app list a To Do list maps to: the default "Tasks" list maps to
 * no list; any other list maps to the app list with the same name
 * (case-insensitive), or null if there isn't one yet.
 */
export function appListIdFor(
  list: GraphTodoList,
  appLists: { id: string; name: string }[]
): string | null {
  if (list.wellknownListName === 'defaultList') return null
  const name = list.displayName.trim().toLowerCase()
  return appLists.find((l) => l.name.trim().toLowerCase() === name)?.id ?? null
}
