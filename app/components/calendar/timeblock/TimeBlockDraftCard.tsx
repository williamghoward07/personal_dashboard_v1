'use client'

import { Check, X } from 'lucide-react'
import { formatHHmm } from '@/lib/timeblock/time'
import { MIN_BLOCK_MINUTES } from '@/lib/timeblock/constants'
import type { PlacedBlock } from '@/lib/timeblock/types'

export interface TimeBlockDraft extends PlacedBlock {
  clientId: string
  status: 'pending' | 'accepted' | 'rejected'
  error: string | null
}

const SOURCE_LABEL: Record<TimeBlockDraft['candidate']['source'], string> = {
  todo: 'Todo',
  education_task: 'Education task',
}

// Pending/accepted/rejected three-way render, mirroring capture/
// DraftCard's pattern — simpler here since Confirm writes directly (no
// secondary review-form branch, nothing was AI-extracted).
export default function TimeBlockDraftCard({
  draft,
  busy,
  onConfirm,
  onDismiss,
  onDurationChange,
}: {
  draft: TimeBlockDraft
  busy: boolean
  onConfirm: () => void
  onDismiss: () => void
  onDurationChange: (minutes: number) => void
}) {
  const durationMinutes = draft.endMinutes - draft.startMinutes
  const maxDuration = draft.gapEndMinutes - draft.startMinutes

  if (draft.status === 'accepted') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-habit-purple/30 bg-habit-purple/5 px-3 py-2 text-sm text-on-surface-variant">
        <Check className="h-3.5 w-3.5 shrink-0 text-habit-purple" />
        <span className="truncate">
          {draft.candidate.title} — scheduled {formatHHmm(draft.startMinutes)}–{formatHHmm(draft.endMinutes)}
        </span>
      </div>
    )
  }

  if (draft.status === 'rejected') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant/60 line-through">
        <span className="truncate">{draft.candidate.title}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-habit-purple/40 bg-habit-purple/10 p-3">
      <p className="label-caps text-habit-purple">
        {SOURCE_LABEL[draft.candidate.source]}
      </p>
      <p className="text-sm text-on-surface">{draft.candidate.title}</p>
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span>
          {formatHHmm(draft.startMinutes)}–{formatHHmm(draft.endMinutes)}
        </span>
        <span className="text-on-surface-variant/50">·</span>
        <label className="flex items-center gap-1">
          <input
            type="number"
            step={5}
            min={MIN_BLOCK_MINUTES}
            max={maxDuration}
            value={durationMinutes}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (!Number.isFinite(value)) return
              onDurationChange(Math.min(maxDuration, Math.max(MIN_BLOCK_MINUTES, value)))
            }}
            className="w-14 rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-xs text-on-surface outline-none focus:border-habit-purple"
          />
          min
        </label>
      </div>
      {draft.error && <p className="text-xs text-error">{draft.error}</p>}
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="flex items-center gap-1 rounded-md bg-habit-purple px-2.5 py-1.5 text-xs font-semibold text-surface disabled:opacity-60"
        >
          <Check className="h-3 w-3" />
          {busy ? 'Scheduling…' : 'Confirm'}
        </button>
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
