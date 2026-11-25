// Dashboard-side row types for the bb_* tables as stored
// (supabase/migrations/20261109000000_blackboard_sync.sql and
// 20261113000000_blackboard_work.sql). Pure types and constants: no Next,
// Supabase or server-only imports.
//
// The *Row types in normalise.ts are the sync payload (keyed by Blackboard
// ids); the *Record types here are what a dashboard read gets back (uuid ids,
// timestamps, dashboard-owned columns). Timestamps are ISO strings, `date`
// columns are 'YYYY-MM-DD' strings.

import type { BbAssignmentStatus, BbContentKind } from './normalise'

// ------------------------------------------------------------------ enums --

export const BB_CONTENT_LINK_KINDS = ['talis', 'panopto', 'file', 'slides', 'other'] as const
export type BbContentLinkKind = (typeof BB_CONTENT_LINK_KINDS)[number]

export const BB_CONTENT_ROLES = ['slides', 'reading', 'recording', 'handout', 'task', 'admin', 'other'] as const
export type BbContentRole = (typeof BB_CONTENT_ROLES)[number]

export const BB_KEY_DATE_CATEGORIES = ['summative', 'formative', 'test', 'tutorial', 'session_task', 'other'] as const
export type BbKeyDateCategory = (typeof BB_KEY_DATE_CATEGORIES)[number]

export const BB_KEY_DATE_STATUSES = ['suggested', 'confirmed', 'dismissed'] as const
export type BbKeyDateStatus = (typeof BB_KEY_DATE_STATUSES)[number]

export const BB_SESSION_OVERRIDE_ACTIONS = ['hide', 'attach'] as const
export type BbSessionOverrideAction = (typeof BB_SESSION_OVERRIDE_ACTIONS)[number]

/** One entry of bb_content.links. */
export interface BbContentLink {
  href: string
  label: string
  kind: BbContentLinkKind
  /** Set for embedded and attached files (pptx, pdf, docx …). */
  mime?: string
}

// ---------------------------------------------------- sync-owned tables --

/** A bb_courses row. `workspace_id` and `week_offset` are dashboard-side. */
export interface BbCourseRecord {
  id: string
  user_id: string
  bb_id: string
  course_code: string
  module_code: string | null
  name: string
  term: string | null
  workspace_id: string | null
  week_offset: number
  url: string | null
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

/** A bb_assignments row. `done_at` is dashboard-side ("mark as done"). */
export interface BbAssignmentRecord {
  id: string
  user_id: string
  bb_id: string
  course_id: string
  title: string
  due_at: string | null
  bb_content_id: string | null
  status: BbAssignmentStatus
  /** Null = Blackboard didn't say. */
  is_formative: boolean | null
  url: string | null
  done_at: string | null
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

/** A bb_content row. `body_hash` is generated from title + body_text. */
export interface BbContentRecord {
  id: string
  user_id: string
  bb_id: string
  course_id: string
  parent_bb_id: string | null
  title: string
  kind: BbContentKind
  available_from: string | null
  path: string[]
  week_label: number | null
  url: string | null
  body_text: string | null
  links: BbContentLink[]
  body_hash: string
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

/** A bb_announcements row. `read_at` and `ai_hash` are dashboard-side. */
export interface BbAnnouncementRecord {
  id: string
  user_id: string
  bb_id: string
  course_id: string
  title: string
  body_text: string | null
  posted_at: string | null
  url: string | null
  read_at: string | null
  body_hash: string
  /** The body_hash AI extraction last processed. */
  ai_hash: string | null
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

/** A bb_documents row without the (up to 500k character) `text`. */
export interface BbDocument {
  id: string
  user_id: string
  content_id: string
  /** Blackboard's attachment id. */
  bb_id: string
  file_name: string
  mime_type: string | null
  byte_size: number | null
  version: string | null
  page_count: number | null
  /** md5 of `text`, generated. */
  text_hash: string
  /** Dashboard-side: the text_hash AI extraction last processed. */
  ai_hash: string | null
  fetched_at: string
  removed_at: string | null
  created_at: string
}

export interface BbDocumentWithText extends BbDocument {
  text: string
}

// ----------------------------------------------- dashboard-owned tables --

/** A bb_content_ai row: AI classification of one content item. */
export interface BbContentAi {
  id: string
  user_id: string
  content_id: string
  role: BbContentRole
  uni_week: number | null
  session_type: string | null
  lecture_ordinal: number | null
  explicit_date: string | null
  /** bb_content.body_hash at the last classification. */
  classified_hash: string | null
  /** bb_content.body_hash at the last date extraction. */
  extracted_hash: string | null
  read_with_ai: boolean
  model: string | null
  updated_at: string
  created_at: string
}

/** A bb_key_dates row. Exactly one of announcement_id / content_id / document_id is set. */
export interface BbKeyDate {
  id: string
  user_id: string
  course_id: string
  announcement_id: string | null
  content_id: string | null
  document_id: string | null
  title: string
  category: BbKeyDateCategory
  due_on: string
  due_at: string | null
  /** What the AI originally said, kept when due_on is edited. */
  ai_due_on: string | null
  for_session_type: string | null
  for_week: number | null
  /** Verbatim source text. */
  quote: string
  status: BbKeyDateStatus
  /** Same deadline as an official assignment. */
  assignment_id: string | null
  done_at: string | null
  fingerprint: string
  model: string | null
  updated_at: string
  created_at: string
}

/** A bb_session_overrides row. `session_uid` is an ICS UID or `gcal:<id>`. */
export interface BbSessionOverride {
  id: string
  user_id: string
  session_uid: string
  content_id: string
  action: BbSessionOverrideAction
  created_at: string
}
