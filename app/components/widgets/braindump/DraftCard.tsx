'use client'

import { Check, X, Pencil } from 'lucide-react'
import type { BrainDumpDraft, BrainDumpDraftKind } from '@/lib/braindump/extract'

export interface LocalDraft extends BrainDumpDraft {
  clientId: string
  status: 'pending' | 'accepted' | 'rejected'
}

const KIND_LABEL: Record<BrainDumpDraftKind, string> = {
  todo: 'Todo',
  education_task: 'Education task',
  calendar_event: 'Calendar event',
  new_person: 'New person',
  update_person: 'Update person',
  log_interaction: 'Log conversation',
}

const ACT_KINDS: BrainDumpDraftKind[] = ['todo', 'education_task', 'calendar_event']

function summaryText(draft: LocalDraft, matchedPersonName: string | null): string {
  switch (draft.kind) {
    case 'todo':
    case 'education_task':
    case 'calendar_event':
      return draft.act?.title ?? 'Untitled'
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

// One card per extracted item, independent accept/edit/reject state —
// the batch-review counterpart to AiQueryBar's single confirm/dismiss
// card and QuickAddBar's single prefilled-form flow.
export default function DraftCard({
  draft,
  matchedPersonName,
  busy,
  onConfirmAct,
  onReview,
  onDismiss,
}: {
  draft: LocalDraft
  matchedPersonName: string | null
  busy: boolean
  onConfirmAct: () => void
  onReview: () => void
  onDismiss: () => void
}) {
  const isAct = ACT_KINDS.includes(draft.kind)

  if (draft.status === 'accepted') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-habit-purple/30 bg-habit-purple/5 px-3 py-2 text-sm text-on-surface-variant">
        <Check className="h-3.5 w-3.5 shrink-0 text-habit-purple" />
        <span className="truncate">{summaryText(draft, matchedPersonName)} — added</span>
      </div>
    )
  }

  if (draft.status === 'rejected') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant/60 line-through">
        <span className="truncate">{summaryText(draft, matchedPersonName)}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-habit-purple/40 bg-habit-purple/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-habit-purple">{KIND_LABEL[draft.kind]}</p>
      <p className="text-sm text-on-surface">{summaryText(draft, matchedPersonName)}</p>
      {draft.act && (draft.act.due_date || draft.act.due_time) && (
        <p className="text-xs text-on-surface-variant">
          {draft.act.due_date}
          {draft.act.due_time ? ` · ${draft.act.due_time}` : ''}
        </p>
      )}
      <div className="mt-1 flex items-center gap-2">
        {isAct ? (
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmAct}
            className="flex items-center gap-1 rounded-md bg-habit-purple px-2.5 py-1.5 text-xs font-semibold text-surface disabled:opacity-60"
          >
            <Check className="h-3 w-3" />
            {busy ? 'Adding…' : 'Confirm'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onReview}
            className="flex items-center gap-1 rounded-md bg-habit-purple px-2.5 py-1.5 text-xs font-semibold text-surface"
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
