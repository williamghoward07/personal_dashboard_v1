// The write shape app/api/capture/confirm accepts. Browser-safe (types
// only), shared by the capture UI and the server.

export type ActEntity = 'todo' | 'education_task' | 'calendar_event'

export interface ActDraft {
  entity: ActEntity
  title: string
  // ISO date (YYYY-MM-DD), resolved from relative phrases against referenceNow.
  due_date: string | null
  // 24h HH:mm — only meaningful for todos and calendar events.
  due_time: string | null
  notes: string | null
}
