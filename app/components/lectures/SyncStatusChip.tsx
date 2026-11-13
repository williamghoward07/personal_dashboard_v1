'use client'

import { useState } from 'react'
import InfoPopover from '../InfoPopover'
import { Button } from '@/components/ui/button'
import { useBbProcessing, type BbProcessing } from '@/lib/blackboard/use-bb-processing'
import { useSyncStatus } from '@/lib/blackboard/use-sync-status'
import { ACCENT_BAR, ACCENT_TEXT, type Accent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { failedLabel, processingLabel, syncLabel, type SyncTone } from './work-format'

/** "Read 3 new or changed items of 320, 2 dated tasks found" once a run that read something finishes. */
function finishedLabel({ scope, totals }: Pick<BbProcessing, 'scope' | 'totals'>): string | null {
  if (scope.read <= 0) return null
  const read = `Read ${scope.read} new or changed ${scope.read === 1 ? 'item' : 'items'} of ${Math.max(scope.total, scope.read)}`
  return totals.added > 0 ? `${read}, ${totals.added} dated ${totals.added === 1 ? 'task' : 'tasks'} found` : read
}

const TONE_ACCENT: Record<SyncTone, Accent> = { ok: 'mint', warn: 'amber', bad: 'crimson' }

/**
 * One status line for the top of the /lectures list: when Blackboard last
 * synced, and what the AI is reading. Mount it once per page: it starts the
 * page's processing loop (`useBbProcessing({ auto: true })`).
 */
export default function SyncStatusChip() {
  const sync = useSyncStatus()
  const processing = useBbProcessing({ auto: true })
  // Fixed for the page's lifetime, like the list's "now".
  const [now] = useState(() => new Date())

  const syncLine = sync.loading ? null : syncLabel(sync.state, sync.lastOkAt, now)
  const readLine = processing.state === 'done' ? finishedLabel(processing) : processingLabel(processing)

  return (
    <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
      {syncLine && (
        <span className={cn('flex items-center gap-1.5', syncLine.tone !== 'ok' && ACCENT_TEXT[TONE_ACCENT[syncLine.tone]])}>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ACCENT_BAR[TONE_ACCENT[syncLine.tone]])} aria-hidden />
          {syncLine.text}
        </span>
      )}
      {readLine && <span>{readLine}</span>}
      {processing.state === 'error' && (
        <span className="flex items-center gap-2">
          <span className="text-error">{processing.error ?? 'Processing failed'}</span>
          <Button variant="outline" size="sm" onClick={processing.run}>
            Retry
          </Button>
        </span>
      )}
      {processing.failed > 0 && processing.state !== 'running' && (
        <span className="flex items-center gap-2">
          {failedLabel(processing.failed)}
          <Button variant="outline" size="sm" onClick={processing.retryFailed}>
            Try again
          </Button>
        </span>
      )}
      {processing.notes.length > 0 && (
        <InfoPopover label="Notes from reading Blackboard">
          <ul className="flex flex-col gap-1.5 text-sm text-on-surface-variant">
            {processing.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </InfoPopover>
      )}
    </div>
  )
}
