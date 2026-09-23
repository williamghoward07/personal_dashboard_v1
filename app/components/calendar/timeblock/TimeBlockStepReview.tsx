'use client'

import TimeBlockDraftCard, { type TimeBlockDraft } from './TimeBlockDraftCard'
import type { TimeBlockCandidateItem } from '@/lib/timeblock/types'

const SOURCE_LABEL: Record<TimeBlockCandidateItem['source'], string> = {
  todo: 'Todo',
  education_task: 'Education task',
}

export default function TimeBlockStepReview({
  drafts,
  unplaced,
  confirmingId,
  onConfirm,
  onDismiss,
  onDurationChange,
  onBack,
  onDone,
}: {
  drafts: TimeBlockDraft[]
  unplaced: TimeBlockCandidateItem[]
  confirmingId: string | null
  onConfirm: (clientId: string) => void
  onDismiss: (clientId: string) => void
  onDurationChange: (clientId: string, minutes: number) => void
  onBack: () => void
  onDone: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {drafts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nothing to place — today&apos;s free time is already spoken for.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {drafts.map((draft) => (
            <TimeBlockDraftCard
              key={draft.clientId}
              draft={draft}
              busy={confirmingId === draft.clientId}
              onConfirm={() => onConfirm(draft.clientId)}
              onDismiss={() => onDismiss(draft.clientId)}
              onDurationChange={(minutes) => onDurationChange(draft.clientId, minutes)}
            />
          ))}
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-outline-variant/60 p-3">
          <p className="label-caps text-on-surface-variant">Didn&apos;t fit today</p>
          <ul className="flex flex-col gap-0.5">
            {unplaced.map((item) => (
              <li key={item.id} className="text-xs text-on-surface-variant">
                {SOURCE_LABEL[item.source]} · {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface hover:brightness-110"
        >
          Done
        </button>
      </div>
    </div>
  )
}
