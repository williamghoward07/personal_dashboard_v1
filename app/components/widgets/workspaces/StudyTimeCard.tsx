'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { ProgressRing } from '@/components/ui/progress-ring'
import type { WorkspaceTimeLog } from '@/lib/types'
import {
  QUICK_MINUTES,
  entriesThisWeek,
  formatMinutes,
  parseMinutesInput,
  timeSummary,
  todayKey,
  weekRingPercent,
} from '@/lib/workspaces/time'
import type { TimeLogInput } from '@/lib/workspaces/use-workspace-time'
import Popover from '../../Popover'
import HoldRadialMenu from '../../HoldRadialMenu'
import ConfirmDialog from '../../ConfirmDialog'
import {
  filterChipActiveClass,
  filterChipClass,
  filterChipInactiveClass,
  iconButtonClass,
  inputClass,
  microLabelClass,
  primaryButtonClass,
  wsAccentStyle,
} from './shared'

const RADIAL_ITEMS = QUICK_MINUTES.map((m) => ({ value: m as number, label: formatMinutes(m) }))

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayLabel = (day: string) => WEEKDAY.format(new Date(`${day}T00:00:00Z`))

/**
 * Minutes picker: 15-minute chips for the usual case, plus an exact field
 * ("50", "1:35", "1h35") for anything else. Typing in the field wins.
 */
function MinutesPicker({
  chosen,
  exact,
  onChip,
  onExact,
}: {
  chosen: number | null
  exact: string
  onChip: (minutes: number) => void
  onExact: (text: string) => void
}) {
  const exactInvalid = exact.trim() !== '' && parseMinutesInput(exact) === null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChip(m)}
            aria-pressed={!exact.trim() && chosen === m}
            className={`${filterChipClass} tabular-nums ${
              !exact.trim() && chosen === m ? filterChipActiveClass : filterChipInactiveClass
            }`}
          >
            {formatMinutes(m)}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-on-surface-variant">
        Exact
        <input
          value={exact}
          onChange={(e) => onExact(e.target.value)}
          placeholder="e.g. 50 or 1:35"
          inputMode="numeric"
          aria-invalid={exactInvalid}
          className={`${inputClass} w-28 py-1 ${exactInvalid ? 'border-error' : ''}`}
        />
        {exactInvalid && <span className="text-error">1 min – 24 h</span>}
      </label>
    </div>
  )
}

function pickedMinutes(chosen: number | null, exact: string): number | null {
  return exact.trim() ? parseMinutesInput(exact) : chosen
}

function EntryRow({
  log,
  onUpdate,
  onDelete,
}: {
  log: WorkspaceTimeLog
  onUpdate: (patch: Partial<TimeLogInput>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [chosen, setChosen] = useState<number | null>(log.minutes)
  const [exact, setExact] = useState('')

  if (editing) {
    const minutes = pickedMinutes(chosen, exact)
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-ws-accent/30 bg-surface-container p-2">
        <span className="text-xs text-on-surface-variant">{dayLabel(log.day)}</span>
        <MinutesPicker
          chosen={chosen}
          exact={exact}
          onChip={(m) => {
            setChosen(m)
            setExact('')
          }}
          onExact={setExact}
        />
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(false)} className={iconButtonClass} aria-label="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={minutes === null}
            onClick={() => {
              if (minutes === null) return
              onUpdate({ minutes })
              setEditing(false)
            }}
            className={iconButtonClass}
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-on-surface-variant">{dayLabel(log.day)}</span>
      <span className="w-14 shrink-0 font-semibold tabular-nums text-on-surface">{formatMinutes(log.minutes)}</span>
      <span className="min-w-0 flex-1 truncate text-on-surface-variant">{log.note}</span>
      <button
        type="button"
        onClick={() => {
          setChosen(QUICK_MINUTES.includes(log.minutes as (typeof QUICK_MINUTES)[number]) ? log.minutes : null)
          setExact(QUICK_MINUTES.includes(log.minutes as (typeof QUICK_MINUTES)[number]) ? '' : String(log.minutes))
          setEditing(true)
        }}
        aria-label={`Edit ${formatMinutes(log.minutes)} on ${dayLabel(log.day)}`}
        className={iconButtonClass}
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${formatMinutes(log.minutes)} on ${dayLabel(log.day)}`}
        className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  )
}

// The "Study time" stat card: this week's total against a weekly target
// (or last week), plus a Log time popover for entering Opal sessions by
// hand — 15-minute chips, or exact minutes — and fixing this week's
// entries. In place (not a modal) so it keeps the workspace accent.
export default function StudyTimeCard({
  logs,
  error,
  targetMinutes,
  addLog,
  updateLog,
  removeLog,
  onSetTarget,
}: {
  logs: WorkspaceTimeLog[]
  error: string | null
  targetMinutes: number | null
  addLog: (input: TimeLogInput) => Promise<boolean>
  updateLog: (id: string, patch: Partial<TimeLogInput>) => Promise<void>
  removeLog: (id: string) => Promise<void>
  onSetTarget: (minutes: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<number | null>(15)
  const [exact, setExact] = useState('')
  const [day, setDay] = useState(() => todayKey())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<WorkspaceTimeLog | null>(null)
  const [targetDraft, setTargetDraft] = useState<string | null>(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [quickLogged, setQuickLogged] = useState<string | null>(null)
  const quickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (quickTimer.current) clearTimeout(quickTimer.current)
    },
    []
  )

  const summary = useMemo(() => timeSummary(logs), [logs])
  const percent = weekRingPercent(summary, targetMinutes)
  const thisWeek = useMemo(() => entriesThisWeek(logs), [logs])
  const minutes = pickedMinutes(chosen, exact)

  const save = async () => {
    if (saving || minutes === null) return
    setSaving(true)
    try {
      const ok = await addLog({ day, minutes, note: note.trim() || null })
      if (ok) {
        setExact('')
        setNote('')
      }
    } finally {
      setSaving(false)
    }
  }

  // Hold Log time → wheel → release: logs today straight away, no popover.
  const quickLog = async (m: number) => {
    if (quickTimer.current) clearTimeout(quickTimer.current)
    setQuickLogged(`Logging ${formatMinutes(m)}…`)
    const ok = await addLog({ day: todayKey(), minutes: m, note: null })
    setQuickLogged(ok ? `Logged ${formatMinutes(m)} today` : `Couldn't log ${formatMinutes(m)}`)
    quickTimer.current = setTimeout(() => setQuickLogged(null), 2500)
  }

  const commitTarget = () => {
    if (targetDraft === null) return
    const hours = Number(targetDraft)
    onSetTarget(targetDraft.trim() && hours > 0 ? Math.round(hours * 60) : null)
    setTargetDraft(null)
  }

  const detail = [
    targetMinutes ? `of ${formatMinutes(targetMinutes)} target` : `last week ${formatMinutes(summary.lastWeek)}`,
    `${formatMinutes(summary.total)} total`,
  ].join(' · ')

  return (
    <ModuleGlassCard
      style={wsAccentStyle}
      size="sm"
      // Raised while the log is open so it paints over the cards below.
      className={`flex items-center justify-between gap-3 ${open || wheelOpen ? 'relative z-30' : ''}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className={microLabelClass}>Study time · this week</span>
        <span className="font-mono text-headline-lg font-bold tabular-nums text-on-surface">
          {formatMinutes(summary.thisWeek)}
        </span>
        <span className="truncate text-xs text-on-surface-variant">{detail}</span>

        <Popover
          label="Log study time"
          open={open}
          onOpenChange={setOpen}
          className="mt-1 w-fit"
          panelClassName="w-80"
          trigger={({ onClick, ...props }) => (
            <HoldRadialMenu
              items={RADIAL_ITEMS}
              onPick={(m) => void quickLog(m)}
              onClick={onClick}
              onOpenChange={setWheelOpen}
              hint="Release to log"
            >
              {(hold) => (
                <button
                  type="button"
                  {...props}
                  {...hold}
                  title="Click to log time · hold to quick-log today"
                  className={`${primaryButtonClass} w-fit touch-none py-1 select-none`}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  Log time
                </button>
              )}
            </HoldRadialMenu>
          )}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
            className="flex flex-col gap-3"
          >
            <span className={microLabelClass}>Log study time</span>
            <MinutesPicker
              chosen={chosen}
              exact={exact}
              onChip={(m) => {
                setChosen(m)
                setExact('')
              }}
              onExact={setExact}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={day}
                max={todayKey()}
                onChange={(e) => setDay(e.target.value || todayKey())}
                aria-label="Day"
                className={`${inputClass} py-1`}
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Note"
                className={`${inputClass} min-w-0 flex-1 py-1`}
              />
            </div>
            <button
              type="submit"
              disabled={minutes === null || saving}
              aria-busy={saving}
              className={`${primaryButtonClass} justify-center`}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : minutes ? `Log ${formatMinutes(minutes)}` : 'Log'}
            </button>
            {error && <p className="text-xs text-error">{error}</p>}
          </form>

          <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant/60 pt-3">
            <span className={microLabelClass}>This week</span>
            {thisWeek.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Nothing logged yet this week.</p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {thisWeek.map((log) => (
                  <EntryRow
                    key={log.id}
                    log={log}
                    onUpdate={(patch) => void updateLog(log.id, patch)}
                    onDelete={() => setDeleting(log)}
                  />
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Weekly target
              <input
                value={targetDraft ?? (targetMinutes ? String(+(targetMinutes / 60).toFixed(2)) : '')}
                onChange={(e) => setTargetDraft(e.target.value)}
                onBlur={commitTarget}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitTarget()
                  }
                }}
                placeholder="none"
                inputMode="decimal"
                className={`${inputClass} w-16 py-1`}
              />
              hours
            </label>
          </div>
        </Popover>
        {quickLogged && (
          <span role="status" className="text-xs text-ws-accent">
            {quickLogged}
          </span>
        )}
      </div>

      <div title={targetMinutes ? 'This week against your weekly target' : 'This week against last week'}>
        <ProgressRing
          style={wsAccentStyle}
          value={percent}
          size="md"
          showValue
          formatValue={() => <Clock className="h-4 w-4 text-ws-accent" strokeWidth={1.75} />}
        />
      </div>

      <ConfirmDialog
        isOpen={deleting !== null}
        message={deleting ? `Delete ${formatMinutes(deleting.minutes)} logged on ${dayLabel(deleting.day)}?` : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void removeLog(deleting.id)
          setDeleting(null)
        }}
      />
    </ModuleGlassCard>
  )
}
