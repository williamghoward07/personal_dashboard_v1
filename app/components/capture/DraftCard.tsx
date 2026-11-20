'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { Check, Pencil, SquarePen, X } from 'lucide-react'
import type { BrainDumpActFields, BrainDumpDraftKind, LocalDraft } from '@/lib/braindump/types'
import { isActKind } from '@/lib/braindump/types'
import BrainDumpDraftRow from '../widgets/braindump/BrainDumpDraftRow'
import styles from '../widgets/braindump/BrainDump.module.css'

// Static class sets so Tailwind can see every class name.
export const DRAFT_TONES = {
  purple: {
    card: 'border-habit-purple/40 bg-habit-purple/10',
    done: 'border-habit-purple/30 bg-habit-purple/5',
    text: 'text-habit-purple',
    solid: 'bg-habit-purple',
    focus: 'focus:border-habit-purple',
  },
  orange: {
    card: 'border-academic-orange/40 bg-academic-orange/10',
    done: 'border-academic-orange/30 bg-academic-orange/5',
    text: 'text-academic-orange',
    solid: 'bg-academic-orange',
    focus: 'focus:border-academic-orange',
  },
} as const

export type DraftTone = keyof typeof DRAFT_TONES

const KIND_LABEL: Record<BrainDumpDraftKind, string> = {
  todo: 'Todo',
  education_task: 'Education task',
  calendar_event: 'Calendar event',
  new_person: 'New person',
  update_person: 'Update person',
  log_interaction: 'Log conversation',
}

function summaryText(draft: LocalDraft, matchedPersonName: string | null): string {
  switch (draft.kind) {
    case 'todo':
    case 'education_task':
    case 'calendar_event':
      return draft.act?.title || 'Untitled'
    case 'new_person':
      return draft.person?.full_name ?? 'New person'
    case 'update_person':
      return matchedPersonName ? `Update ${matchedPersonName}` : (draft.person?.full_name ?? 'Update person')
    case 'log_interaction':
      return draft.interaction?.summary ?? 'Logged conversation'
    default:
      return 'Item'
  }
}

/** Why a one-click draft can't be saved as it stands, if it can't. */
export function draftProblem(draft: LocalDraft): string | null {
  if (!isActKind(draft.kind)) return null
  if (!draft.act?.title.trim()) return 'Needs a title.'
  if (draft.kind === 'calendar_event' && !draft.act.due_date) return 'A calendar event needs a date.'
  return null
}

// One card per extracted item, each with its own confirm/edit/dismiss.
// Todos, education tasks and events save in one click (and can be edited
// inline first); people drafts open the full form for review.
export default function DraftCard({
  draft,
  tone,
  brainDump = false,
  matchedPersonName,
  busy,
  saving = busy,
  onConfirm,
  onReview,
  onDismiss,
  onEdit,
}: {
  draft: LocalDraft
  tone: DraftTone
  brainDump?: boolean
  matchedPersonName: string | null
  busy: boolean
  saving?: boolean
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void
  onReview: (event: MouseEvent<HTMLButtonElement>) => void
  onDismiss: () => void
  onEdit: (patch: Partial<BrainDumpActFields>) => void
}) {
  const [editing, setEditing] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const t = DRAFT_TONES[tone]
  const isAct = isActKind(draft.kind)
  const problem = draftProblem(draft)
  const summary = summaryText(draft, matchedPersonName)

  const inputClass = brainDump ? styles.editorInput : `w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm text-on-surface outline-none ${t.focus}`
  const editor = editing && draft.act ? (
    <div className={brainDump ? styles.editor : 'flex flex-col gap-1.5'}>
      <input
        value={draft.act.title}
        onChange={(e) => onEdit({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (brainDump && e.key === 'Escape')) {
            setEditing(false)
            editButton.current?.focus()
          }
        }}
        aria-label="Title"
        placeholder={brainDump ? 'Title' : undefined}
        autoFocus
        disabled={brainDump && busy}
        className={inputClass}
      />
      <div className={brainDump ? styles.editorDates : 'flex gap-1.5'}>
        <input
          type="date"
          value={draft.act.due_date ?? ''}
          onChange={(e) => onEdit({ due_date: e.target.value || null })}
          aria-label="Date"
          disabled={brainDump && busy}
          className={inputClass}
        />
        {draft.kind !== 'education_task' && (
          <input
            type="time"
            value={draft.act.due_time ?? ''}
            onChange={(e) => onEdit({ due_time: e.target.value || null })}
            aria-label="Time"
            disabled={brainDump && busy}
            className={inputClass}
          />
        )}
      </div>
      {brainDump && (
        <textarea
          value={draft.act.notes ?? ''}
          onChange={(e) => onEdit({ notes: e.target.value || null })}
          aria-label="Notes"
          placeholder="Notes"
          rows={2}
          disabled={busy}
          className={inputClass}
        />
      )}
    </div>
  ) : null

  if (brainDump) {
    return (
      <BrainDumpDraftRow
        draft={draft}
        kindLabel={KIND_LABEL[draft.kind]}
        summary={summary}
        problem={problem}
        editor={editor}
        actions={
          <>
            {isAct ? (
              <>
                <button
                  type="button"
                  className={styles.confirmButton}
                  disabled={busy || !!problem}
                  onClick={onConfirm}
                >
                  {saving ? 'Adding…' : 'Confirm'}
                </button>
                <button
                  ref={editButton}
                  type="button"
                  disabled={busy || !draft.act}
                  aria-expanded={editing}
                  onClick={() => setEditing((value) => !value)}
                >
                  {editing ? 'Done' : 'Edit'}
                </button>
              </>
            ) : (
              <button type="button" className={styles.reviewButton} disabled={busy} onClick={onReview}>
                Review
              </button>
            )}
            <button type="button" disabled={busy} onClick={onDismiss}>Dismiss</button>
          </>
        }
      />
    )
  }

  if (draft.status === 'accepted') {
    return (
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-on-surface-variant ${t.done}`}>
        <Check className={`h-3.5 w-3.5 shrink-0 ${t.text}`} />
        <span className="truncate">{summary} — added</span>
      </div>
    )
  }

  if (draft.status === 'rejected') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant/60 line-through">
        <span className="truncate">{summary}</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${t.card}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${t.text}`}>{KIND_LABEL[draft.kind]}</p>
        {isAct && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            aria-label={editing ? 'Done editing' : `Edit ${summary}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <SquarePen className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {editor ?? (
        <>
          <p className="text-sm text-on-surface">{summary}</p>
          {draft.act && (draft.act.due_date || draft.act.due_time) && (
            <p className="text-xs text-on-surface-variant">
              {draft.act.due_date}
              {draft.act.due_time ? ` · ${draft.act.due_time}` : ''}
            </p>
          )}
        </>
      )}

      {draft.kind === 'education_task' && (
        <p className="text-[11px] text-on-surface-variant">Counts on Daily Goals — not listed in Education yet.</p>
      )}
      {problem && <p className="text-[11px] text-academic-orange">{problem}</p>}

      <div className="mt-1 flex items-center gap-2">
        {isAct ? (
          <button
            type="button"
            disabled={busy || !!problem}
            onClick={onConfirm}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-surface disabled:opacity-50 ${t.solid}`}
          >
            <Check className="h-3 w-3" />
            {saving ? 'Adding…' : 'Confirm'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onReview}
            disabled={busy}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-surface ${t.solid}`}
          >
            <Pencil className="h-3 w-3" />
            Review
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="flex items-center gap-1 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60"
        >
          <X className="h-3 w-3" />
          Dismiss
        </button>
      </div>
    </div>
  )
}
