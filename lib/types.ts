export interface Year {
  id: string
  name: string
  start_date: string | null
  created_at: string
}

export interface Module {
  id: string
  year_id: string
  name: string
  // Set when this module is linked to a OneNote section for in-app
  // browsing (see lib/microsoft/graph.ts). section_name is cached for
  // display only, refreshed whenever the link is (re)picked.
  onenote_section_id: string | null
  onenote_section_name: string | null
  created_at: string
}

// A specific OneNote page a todo can be attached to — created lazily the
// first time a page gains a linked todo (see lib/education/notes-documents.ts).
// OneNote pages themselves are never persisted; this row is local-only.
export interface NotesDocument {
  id: string
  module_id: string
  onenote_page_id: string
  page_title: string
  created_at: string
}

export interface Task {
  id: string
  module_id: string
  title: string
  type: string | null
  due_date: string | null
  credit_weight: number | null
  status: string | null
  grade: string | null
  notes: string | null
  description: string | null
  created_at: string
}

export interface Topic {
  id: string
  module_id: string
  name: string
  confidence: number | null
  created_at: string
}

export interface Prompt {
  id: string
  title: string
  prompt: string
  created_at: string
}

export interface PerplexityLink {
  id: string
  url: string
  title: string
  folder: string
  created_at: string
}

export interface TaskResearchLink {
  id: string
  task_id: string
  prompt_id: string | null
  perplexity_link_id: string | null
  created_at: string
}

// Legacy: superseded by DailyGoalHabit/DailyGoalHabitCompletion below,
// which the Habits page and widget now read/write instead (see the
// 2026-08-16 habits data-model consolidation). Kept only because the
// old habits/habit_logs tables are still around as a rollback safety
// net — nothing in the app imports these anymore.
export type HabitFrequencyType = 'daily' | 'weekly'

export interface Habit {
  id: string
  name: string
  icon: string
  description: string
  color: string
  frequency_type: HabitFrequencyType
  frequency_count: number
  is_quantifiable: boolean
  target_value: number | null
  unit: string | null
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  date: string
  completed: boolean
  value: number | null
  created_at: string
}

// Legacy: superseded by ActivitySession below (see the 2026-08-17
// activity_sessions migration). Kept only because rugby_sessions is
// still around as a rollback safety net — nothing in the app imports
// this anymore.
export interface RugbySession {
  id: string
  date: string
  duration_minutes: number | null
  notes: string | null
  created_at: string
}

export type ActivitySource = 'manual' | 'strava_export'

export interface ActivitySession {
  id: string
  occurred_at: string
  activity_type: string
  source: ActivitySource
  duration_minutes: number | null
  notes: string | null
  distance_km: number | null
  elevation_gain_m: number | null
  external_id: string | null
  raw: Record<string, unknown> | null
  created_at: string
}

export interface TimeLog {
  id: string
  task_id: string
  date: string
  minutes_spent: number
  created_at: string
}

export interface Todo {
  id: string
  title: string
  notes: string | null
  due_date: string | null
  // 24h HH:mm, only meaningful alongside a due_date — null for an
  // all-day/undated todo.
  due_time: string | null
  completed_at: string | null
  created_at: string
  // Legacy Apple Reminders (CalDAV) link — that sync was removed (iCloud
  // never served upgraded reminders); the column remains, always null.
  caldav_uid: string | null
  // The linked Microsoft To Do task. Every top-level todo is created in To
  // Do too (lib/microsoft/todo-sync.ts); null until that succeeds (the next
  // pull retries) or when Microsoft isn't connected.
  mstodo_task_id: string | null
  mstodo_list_id: string | null
  // A subtask's linked To Do "step" (checklist item on the parent's task).
  mstodo_checklist_item_id: string | null
  // Syncs with To Do's "important" flag for linked todos.
  starred: boolean
  list_id: string | null
  // Self-referencing, single-level only (DB trigger). Subtasks sync as To
  // Do steps, so a To Do task is never itself a subtask.
  parent_id: string | null
  // Set when this todo is attached to a specific Education notes document
  // (see NotesDocument) — independent of list_id, a todo can carry both.
  notes_document_id: string | null
  // Scopes this todo into a Workspace's Todos section — independent of
  // workspace_link_todos, which tracks fine-grained link attachment.
  workspace_id: string | null
}

export interface TodoList {
  id: string
  name: string
  color: string
  sort_order: number
  created_at: string
}

export interface EducationTask {
  id: string
  title: string
  notes: string | null
  module_id: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export type DailyGoalHabitFrequency = 'daily' | 'specific_days' | 'times_per_week'
export type DailyGoalHabitWidget = 'habits' | 'health'

export interface DailyGoalHabit {
  id: string
  name: string
  icon: string
  description: string
  frequency_type: DailyGoalHabitFrequency
  days_of_week: number[] | null
  weekly_target: number | null
  widget: DailyGoalHabitWidget
  colour: string
  is_active: boolean
  is_quantifiable: boolean
  target_value: number | null
  unit: string | null
  sort_order: number
  created_at: string
}

export interface DailyGoalHabitCompletion {
  id: string
  habit_id: string
  completed_on: string
  value: number | null
  created_at: string
}

// A checklist step on a habit (e.g. the morning routine). Ticking every
// core step for a day logs the habit's completion for that day (RPC
// set_habit_step_check); bonus steps are extra. Not the same thing as a
// Calendar Routine below.
export interface HabitStep {
  id: string
  habit_id: string
  title: string
  is_core: boolean
  sort_order: number
  created_at: string
}

export interface HabitStepCheck {
  id: string
  step_id: string
  habit_id: string
  checked_on: string
  created_at: string
}

// Calendar page > Routines tab: a reusable, named stack of timed steps that
// can be dragged onto a specific day/time to create a real Google Calendar
// event (see RoutineInstance below). Deliberately separate from
// DailyGoalHabit — routines have no "done today" tracking, just ordered
// timed steps and calendar placements.
export interface Routine {
  id: string
  name: string
  colour: string
  created_at: string
}

export interface RoutineItem {
  id: string
  routine_id: string
  name: string
  description: string
  duration_minutes: number
  sort_order: number
  created_at: string
}

// One scheduled placement of a routine onto the real calendar. routine_name/
// routine_colour/duration_minutes are snapshotted at schedule-time so a
// later-deleted routine template still renders correctly (routine_id is
// nulled, not cascaded, when its template is deleted).
export interface RoutineInstance {
  id: string
  routine_id: string | null
  routine_name: string
  routine_colour: string
  start_at: string
  duration_minutes: number
  google_event_id: string
  created_at: string
}

export type TransactionType = 'income' | 'outgoing'
export type TransactionSource = 'manual' | 'monzo' | 'starling'

export interface Transaction {
  id: string
  date: string
  amount: number | null
  category: string
  description: string | null
  type: TransactionType
  created_at: string
  source: TransactionSource
  external_id: string | null
  account_label: string | null
  merchant_name: string | null
  amount_minor_units: number | null
  raw: Record<string, unknown> | null
  account_id: string | null
}

export type AccountSource = 'starling' | 'manual'

export interface Account {
  id: string
  name: string
  source: AccountSource
  external_id: string | null
  currency: string
  // Manual accounts only — see the migration's column comment. Ignored
  // for Starling accounts, whose balance is always fetched live.
  opening_balance_minor_units: number
  is_pinned: boolean
  is_hidden: boolean
  created_at: string
}

export type PlaceCategory =
  | 'cafe'
  | 'university'
  | 'pub'
  | 'restaurant'
  | 'gym'
  | 'office'
  | 'home'
  | 'event'
  | 'other'

export interface Place {
  id: string
  name: string
  address: string | null
  category: PlaceCategory
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
}

export interface Person {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  linkedin_url: string | null
  photo_url: string | null
  how_we_met: string | null
  birthday: string | null
  notes: string | null
  tags: string[]
  google_resource_name: string | null
  google_etag: string | null
  google_synced_at: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

// People > Instagram follows. Filled by importing Instagram's own
// "Download your information" export (following.json) — no Instagram API.
export interface InstagramFollow {
  id: string
  handle: string
  display_name: string | null
  note: string | null
  category: string | null
  followed_at: string
  person_id: string | null
}

export type InteractionChannel =
  | 'in_person'
  | 'call'
  | 'video'
  | 'message'
  | 'email'
  | 'other'

export interface Interaction {
  id: string
  occurred_at: string
  title: string | null
  summary: string
  channel: InteractionChannel
  place_id: string | null
  created_at: string
}

export interface InteractionPerson {
  id: string
  interaction_id: string
  person_id: string
  created_at: string
}

export interface FollowUp {
  id: string
  person_id: string
  note: string
  due_date: string | null
  completed_at: string | null
  interaction_id: string | null
  created_at: string
}

export interface Integration {
  id: string
  provider: string
  connected_at: string
  expires_at: string | null
  scopes: string[]
  vault_secret_name: string | null
  last_synced_at: string | null
  last_error: string | null
  encrypted_refresh_token: string | null
  sync_token: string | null
  account_email: string | null
}

// color is one of lib/theme.ts's Accent keys, kept as `string` here to
// match this file's style — callers narrow it at the point of use.
export interface LinkFolder {
  id: string
  name: string
  color: string
  sort_order: number
  /** Archived folders (and the links in them) only show under "Archived". */
  archived_at: string | null
  created_at: string
}

export interface QuickLink {
  id: string
  folder_id: string | null
  title: string
  url: string
  favicon_path: string | null
  // A user-supplied image URL that overrides the auto-detected favicon;
  // rendered directly, not cached into the link-favicons bucket (that
  // bucket is keyed by domain and shared across links to the same site).
  favicon_custom_url: string | null
  is_pinned: boolean
  sort_order: number
  last_opened_at: string | null
  archived_at: string | null
  created_at: string
}

// Mirrors public.user_settings (supabase/migrations/20260920000000_user_settings.sql).
// home_layout holds [{ id, span, hidden }] in render order; see
// lib/settings/schema.ts for the normalised/tolerant-merged shape the app
// actually reads/writes (HomeLayoutEntry / UserSettings).
export interface UserSettingsRow {
  user_id: string
  home_layout: unknown
  hidden_nav_items: string[]
  launcher_link_ids: string[]
  updated_at: string
}

export type WorkspaceLinkKind = 'paper' | 'data' | 'doc' | 'other'
export type WorkspaceNoteKind = 'realization' | 'discarded' | 'argument' | 'meeting' | 'note'
// The workspace page's sections, as stored in hidden_sections /
// collapsed_sections (DB check constraint uses the same four keys).
// 'readings' and 'time' are for study-module workspaces and start hidden
// (see 20261009020000_workspace_readings_and_time.sql).
export type WorkspaceSectionKey = 'stats' | 'sources' | 'readings' | 'actions' | 'log' | 'time'

export interface Workspace {
  id: string
  title: string
  // Free-text context line under the title, e.g. "AQA Geography Module 4".
  // Not a FK to modules — Workspaces stays decoupled from Education.
  subtitle: string | null
  archived_at: string | null
  created_at: string
  folder_id: string | null
  // An Accent key; null = inherit from the folder chain (then teal).
  color: string | null
  hidden_sections: WorkspaceSectionKey[]
  collapsed_sections: WorkspaceSectionKey[]
  // Optional goal for the Study time card's ring; null = compare with last week.
  weekly_minutes_target: number | null
  // e.g. "GEOG1081": a module workspace, linked to that module's timetable
  // sessions and shown on /lectures instead of /workspaces. Undefined until
  // 20261019000000_lecture_sessions.sql is applied.
  module_code?: string | null
}

export interface WorkspaceFolder {
  id: string
  name: string
  // An Accent key; null = inherit from the parent folder.
  color: string | null
  parent_id: string | null
  sort_order: number
  created_at: string
}

export interface WorkspaceLink {
  id: string
  workspace_id: string
  title: string
  url: string
  favicon_path: string | null
  position: number
  // Auto-detected from the URL on add, correctable per card afterwards.
  kind: WorkspaceLinkKind
  citation: string | null
  doi: string | null
  // Display-only free text ("4.2 MB", "3,410 words") — never parsed.
  meta_label: string | null
  // Ticked off like a todo; null = still open. Done sources live in a
  // collapsed "Completed" sublist and are skipped by Launch set.
  completed_at: string | null
  // Set = a weekly reading (shown in Readings, grouped by week); null = a
  // source. See lib/workspaces/readings.ts.
  week: number | null
  // A reading (vs a source). Undefined until 20261019000000 is applied.
  is_reading?: boolean
  // The timetable session (ICS UID) this reading is for; null = unassigned.
  session_uid?: string | null
  created_at: string
}

/** What the user has recorded about one timetable session (lib/timetable). */
export interface LectureSession {
  id: string
  uid: string
  module_code: string | null
  title: string
  starts_at: string | null
  notes_done_at: string | null
  // Retired: "nothing to prepare", backfilled into prep_done_at by 20261026010000.
  no_readings: boolean
  // Prep handed in (Mark as done). Follow-up only shows after it.
  prep_done_at: string | null
  note: string | null
  // Prep tracking switched on for a Google event (uid `gcal:…`). Undefined
  // until 20261026000000 is applied; timetable sessions ignore it.
  tracked?: boolean
  created_at: string
}

/**
 * A to-do attached to one session (lib/timetable/session.ts): 'prep' before
 * it, 'post' (a concept to review) after it. A url makes it a reading.
 */
export interface SessionTask {
  id: string
  session_uid: string
  phase: 'prep' | 'post'
  title: string
  url: string | null
  done_at: string | null
  position: number
  created_at: string
}

/** One logged block of study time on a workspace (e.g. from Opal). */
export interface WorkspaceTimeLog {
  id: string
  workspace_id: string
  // Europe/London calendar day, 'YYYY-MM-DD'.
  day: string
  minutes: number
  note: string | null
  created_at: string
}

export interface WorkspaceNote {
  id: string
  workspace_id: string
  body: string
  // Drives the coloured timeline dot and badge. Set at insert time only —
  // workspace_notes is append-only at the DB level.
  kind: WorkspaceNoteKind
  footnote: string | null
  // Custom #tags, lowercase, without the '#'. Insert-time only.
  tags: string[]
  created_at: string
}

export interface WorkspaceSession {
  id: string
  workspace_id: string
  started_at: string
  created_at: string
}

export interface WorkspaceLinkTodo {
  id: string
  workspace_link_id: string
  todo_id: string
  created_at: string
}
