import type { ReactNode } from 'react'
import { CalendarDays, Check, CircleAlert, Layers, UserRound, X } from 'lucide-react'
import type { LocalDraft } from '@/lib/braindump/types'
import { isActKind } from '@/lib/braindump/types'
import styles from './BrainDump.module.css'

const DATE_LABEL = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
  timeZone: 'UTC',
})

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : DATE_LABEL.format(date)
}

export default function BrainDumpDraftRow({
  draft,
  kindLabel,
  summary,
  problem,
  editor,
  actions,
}: {
  draft: LocalDraft
  kindLabel: string
  summary: string
  problem: string | null
  editor: ReactNode
  actions: ReactNode
}) {
  const isAct = isActKind(draft.kind)
  const needsReview = !isAct || Boolean(problem)
  const finished = draft.status !== 'pending'
  const Icon = draft.status === 'rejected' ? X : finished || !needsReview ? Check : CircleAlert
  const DestinationIcon = !isAct ? UserRound : draft.kind === 'calendar_event' ? CalendarDays : Layers
  const destination = !isAct ? 'People' : draft.kind === 'calendar_event' ? 'Calendar' : draft.kind === 'education_task' ? 'Daily Goals' : 'Tasks'
  const date = draft.act?.due_date
  const time = draft.act?.due_time

  return (
    <li className={styles.draft} data-status={draft.status}>
      <span className={styles.indicator} data-ready={!needsReview && !finished} aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className={styles.draftContent}>
        <div className={styles.draftHeader}>
          <span className={styles.kind} data-kind={draft.kind}>{kindLabel}</span>
          <h3>{summary}</h3>
        </div>
        {finished ? (
          <p className={styles.metadata}>{draft.status === 'accepted' ? 'Added' : 'Dismissed'}</p>
        ) : (
          <>
            {editor ?? (
              <p className={styles.metadata}>
                {(date || time) && (
                  <span>
                    <CalendarDays size={16} aria-hidden="true" />
                    {date ? <time dateTime={date}>{dateLabel(date)}</time> : null}
                    {time ? <time dateTime={time}>{time.slice(0, 5)}</time> : null}
                  </span>
                )}
                <span><DestinationIcon size={16} aria-hidden="true" />{destination}</span>
              </p>
            )}
            {needsReview ? <span className={styles.reviewBadge}>Needs review</span> : <span className="sr-only">Ready to confirm</span>}
            {problem && <p className={styles.problem}>{problem}</p>}
            {draft.kind === 'education_task' && (
              <p className={styles.metadata}>Counts on Daily Goals.</p>
            )}
          </>
        )}
      </div>
      {!finished && <div className={styles.draftActions}>{actions}</div>}
    </li>
  )
}
