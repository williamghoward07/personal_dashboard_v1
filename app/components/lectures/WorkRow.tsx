'use client'

import { useState } from 'react'
import { Check, ExternalLink, Sparkles } from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import Popover from '../Popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MetadataChip } from '@/components/ui/metadata-chip'
import { StatusBadge } from '@/components/ui/status-badge'
import { londonToday, londonWallTimeToIso } from '@/lib/blackboard/dates'
import {
  confirmKeyDate,
  dismissKeyDate,
  editKeyDate,
  setAssignmentDone,
  setKeyDateDone,
  type WriteResult,
} from '@/lib/blackboard/work-writes'
import { WORK_CATEGORY_LABEL, type WorkItem } from '@/lib/blackboard/work'
import { ACCENT_BORDER, ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { dueTimeLabel, formatDueDay, relativeDueLabel } from './work-format'

/** The text input's time, 'HH:MM', or '' when the item has no time. */
const timeValue = (item: WorkItem) => dueTimeLabel(item.dueOn, item.dueAt) ?? ''

function EditDateForm({
  item,
  accent,
  onSaved,
}: {
  item: WorkItem
  accent: UiAccent
  onSaved: () => void
}) {
  const initialTime = timeValue(item)
  const [date, setDate] = useState(item.dueOn ?? '')
  const [time, setTime] = useState(initialTime)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!item.keyDateId) return
    if (!date) return setError('Pick a date')
    // An untouched time follows the day; a cleared one is removed.
    let dueAt: string | null | undefined
    if (time !== initialTime) {
      dueAt = time === '' ? null : londonWallTimeToIso(date, time)
      if (time !== '' && dueAt === null) return setError('Not a valid time')
    }
    setSaving(true)
    setError(null)
    const result = await editKeyDate(item.keyDateId, { due_on: date, ...(dueAt !== undefined ? { due_at: dueAt } : {}) })
    setSaving(false)
    if (result.error) setError(result.error)
    else onSaved()
  }

  return (
    <form
      className="flex w-56 flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
        Date
        <Input type="date" size="sm" accent={accent} value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
        Time (optional)
        <Input type="time" size="sm" accent={accent} value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" accent={accent} disabled={saving} className="self-end">
        {saving ? 'Saving…' : 'Save date'}
      </Button>
    </form>
  )
}

/**
 * One official Blackboard assignment or AI-found key date, in SessionRow's
 * layout: toggle · day · time · title + chips · when · actions. An AI-found
 * date keeps an "AI-found" chip (its quote and source in a popover); while
 * it's only suggested it can be confirmed, re-dated or dismissed.
 */
export default function WorkRow({
  item,
  now,
  accent,
  showModule = true,
}: {
  item: WorkItem
  now: Date
  accent: UiAccent
  /** Show the module chip (off inside a module's own list). */
  showModule?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  const run = async (write: () => Promise<WriteResult>) => {
    setBusy(true)
    setError(null)
    const result = await write()
    setBusy(false)
    if (result.error) setError(result.error)
  }

  const isKeyDate = item.source === 'key_date'
  const doneByBlackboard = item.doneVia === 'blackboard'
  const canToggle = !doneByBlackboard && (isKeyDate ? !!item.keyDateId : item.bbStatus === 'not_submitted' && !!item.assignmentId)
  const toggle = () => {
    if (isKeyDate && item.keyDateId) void run(() => setKeyDateDone(item.keyDateId as string, !item.done))
    else if (item.assignmentId) void run(() => setAssignmentDone(item.assignmentId as string, !item.done))
  }

  const time = dueTimeLabel(item.dueOn, item.dueAt)
  const when = item.dueOn && !item.done ? relativeDueLabel(item.dueOn, londonToday(now)) : null
  const overdue = when?.endsWith('overdue') ?? false
  const suggested = item.ai?.status === 'suggested'
  const moduleLabel = item.moduleCode ?? item.courseName

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-container-high/60">
        {canToggle ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={item.done}
            aria-label={item.done ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`}
            disabled={busy}
            onClick={toggle}
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors disabled:opacity-50',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-outline',
              item.done
                ? 'border-primary-container bg-primary-container text-on-primary-container'
                : 'border-outline-variant bg-surface-container-lowest hover:border-outline'
            )}
          >
            {item.done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
          </button>
        ) : (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary-container">
            {item.done && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Done" />}
          </span>
        )}

        <span className="w-20 shrink-0 text-xs text-on-surface-variant">
          {item.dueOn ? formatDueDay(item.dueOn) : 'No date'}
        </span>
        <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">{time ?? ''}</span>

        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn('truncate text-sm text-on-surface', item.done && 'text-on-surface-variant line-through')}>
            {item.title}
          </span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.title} in Blackboard`}
              className="shrink-0 text-outline transition-colors hover:text-on-surface focus:outline-none focus-visible:text-on-surface"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </a>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {showModule && moduleLabel && (
            <MetadataChip accent={item.moduleCode ? accent : 'neutral'} className="max-w-40">
              <span className="truncate">{moduleLabel}</span>
            </MetadataChip>
          )}
          <span className="text-[11px] text-on-surface-variant">{WORK_CATEGORY_LABEL[item.category]}</span>
          {item.bbStatus === 'submitted' && <StatusBadge size="sm" accent="mint">Submitted</StatusBadge>}
          {item.bbStatus === 'graded' && <StatusBadge size="sm" accent="blue">Graded</StatusBadge>}
          {item.ai && (
            <Popover
              label="Where this date came from"
              panelClassName="w-[min(24rem,calc(100vw-2rem))]"
              trigger={(props) => (
                <button
                  type="button"
                  {...props}
                  className="rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
                >
                  <MetadataChip accent="blue" icon={<Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden />}>
                    AI-found
                  </MetadataChip>
                </button>
              )}
            >
              <div className="flex flex-col gap-2 text-sm">
                <span className="label-caps text-on-surface-variant">
                  {suggested ? 'Found by AI, not confirmed yet' : 'Found by AI, confirmed'}
                </span>
                <blockquote className={cn('border-l-2 pl-3 text-on-surface', ACCENT_BORDER.blue)}>
                  &ldquo;{item.ai.quote}&rdquo;
                </blockquote>
                {item.ai.sourceUrl && (
                  <a
                    href={item.ai.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('inline-flex items-center gap-1 self-start text-xs font-semibold hover:underline', ACCENT_TEXT.blue)}
                  >
                    Open source
                    <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
                  </a>
                )}
              </div>
            </Popover>
          )}
          {item.dueFromKeyDateId && (
            <MetadataChip
              accent="blue"
              title="This assignment has no Blackboard due date; the date was found by AI in a Blackboard item."
              icon={<Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden />}
            >
              AI-found date
            </MetadataChip>
          )}
        </span>

        <span
          className={cn(
            'w-28 shrink-0 text-right text-[11px]',
            overdue ? cn('font-semibold', ACCENT_TEXT.crimson) : 'text-on-surface-variant'
          )}
        >
          {when}
        </span>
      </div>

      {item.ai && (
        <div className="flex shrink-0 items-center gap-1">
          {suggested && (
            <Button
              variant="outline"
              size="sm"
              accent={accent}
              disabled={busy}
              onClick={() => void run(() => confirmKeyDate(item.keyDateId as string))}
            >
              Confirm
            </Button>
          )}
          {item.keyDateId && (
            <Popover
              label={`Edit date for ${item.title}`}
              align="end"
              trigger={(props) => (
                <Button variant="ghost" size="sm" accent={accent} disabled={busy} {...props}>
                  Edit date
                </Button>
              )}
            >
              {(close) => <EditDateForm item={item} accent={accent} onSaved={close} />}
            </Popover>
          )}
          {suggested && (
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirmDismiss(true)}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="w-full px-2 text-xs text-error">
          {error}
        </p>
      )}

      <ConfirmDialog
        isOpen={confirmDismiss}
        message="Dismiss this date? It won't be suggested again."
        confirmLabel="Dismiss"
        onCancel={() => setConfirmDismiss(false)}
        onConfirm={() => {
          setConfirmDismiss(false)
          void run(() => dismissKeyDate(item.keyDateId as string))
        }}
      />
    </li>
  )
}
