'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ACCENT_BAR, ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import type { WorkspaceLink } from '@/lib/types'
import { PREP_LABEL, prepStatus, type TimetableSession } from '@/lib/timetable/session'
import { sessionMeta } from '@/lib/timetable/format'
import type { SessionStatePatch } from '@/lib/lectures/prep-writes'
import PrepLight from './PrepLight'

export interface SessionPrepState {
  noReadings: boolean
  notesDone: boolean
  note: string | null
}

const microLabel = 'font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70'

function Tick({
  checked,
  label,
  accent,
  onToggle,
}: {
  checked: boolean
  label: string
  accent: UiAccent
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? cn('border-transparent text-surface-container-lowest', ACCENT_BAR[accent]) : 'border-outline hover:border-on-surface-variant'
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
    </button>
  )
}

function ReadingRow({
  link,
  accent,
  autoEdit,
  onToggle,
  onRename,
  onRemove,
}: {
  link: WorkspaceLink
  accent: UiAccent
  autoEdit: boolean
  onToggle: () => void
  onRename: (title: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(link.title)
  const done = !!link.completed_at

  const commit = () => {
    const title = draft.trim()
    if (title && title !== link.title) onRename(title)
    setEditing(false)
  }

  return (
    <li className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-container-high/50">
      <Tick checked={done} label={done ? `Mark ${link.title} not read` : `Mark ${link.title} read`} accent={accent} onToggle={onToggle} />
      {editing ? (
        <form
          className="flex min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            commit()
          }}
        >
          <Input
            autoFocus
            size="sm"
            accent={accent}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraft(link.title)
                setEditing(false)
              }
            }}
            aria-label="Reading title"
            placeholder="e.g. Harvey (1989) ch. 2"
          />
        </form>
      ) : (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 text-sm',
            done ? 'text-on-surface-variant line-through' : 'text-on-surface hover:underline'
          )}
        >
          <span className="truncate">{link.title}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-40" strokeWidth={1.75} aria-hidden />
        </a>
      )}
      {!editing && (
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button variant="ghost" size="icon-sm" accent={accent} onClick={() => setEditing(true)} aria-label={`Rename ${link.title}`}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
          <Button variant="destructive" size="icon-sm" onClick={onRemove} aria-label={`Remove ${link.title}`}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        </span>
      )}
    </li>
  )
}

/**
 * Prep for one timetable session: its readings (paste a Talis/Blackboard
 * link, tick it off), "no readings for this one", "notes taken" and a short
 * note. Presentational — the calendar popover and /lectures drive it with
 * useSessionPrep, a module workspace with its own link state.
 */
export default function SessionPrepPanel({
  session,
  readings,
  state,
  accent = 'orange',
  loading = false,
  error,
  workspaceHref,
  showHeader = true,
  onAddReading,
  onToggleReading,
  onRenameReading,
  onRemoveReading,
  onSaveState,
}: {
  session: Pick<TimetableSession, 'title' | 'type' | 'moduleName' | 'moduleCode' | 'start' | 'end' | 'location'>
  readings: WorkspaceLink[]
  state: SessionPrepState
  accent?: UiAccent
  loading?: boolean
  error?: string | null
  /** "Open module workspace" link; omitted when already on it. */
  workspaceHref?: string | null
  showHeader?: boolean
  onAddReading: (rawUrl: string) => Promise<WorkspaceLink | null>
  onToggleReading: (link: WorkspaceLink) => void
  onRenameReading: (id: string, title: string) => void
  onRemoveReading: (id: string) => void
  onSaveState: (patch: SessionStatePatch) => void
}) {
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [noteDraft, setNoteDraft] = useState(state.note ?? '')
  // A reading added here opens straight into rename: a pasted link's title
  // is only its domain (durham.rl.talis.com), which says nothing.
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  // Follow the saved note when it changes elsewhere (adjust-during-render,
  // not an effect).
  const [syncedNote, setSyncedNote] = useState(state.note)
  if (state.note !== syncedNote) {
    setSyncedNote(state.note)
    setNoteDraft(state.note ?? '')
  }

  const done = readings.filter((r) => r.completed_at).length
  const status = prepStatus({ done, total: readings.length }, state.noReadings)

  const submit = async () => {
    if (!url.trim() || adding) return
    setAdding(true)
    const created = await onAddReading(url)
    if (created) {
      setUrl('')
      setJustAddedId(created.id)
    }
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {showHeader && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <PrepLight status={status} notesDone={state.notesDone} />
            <span className={cn('text-sm font-semibold', ACCENT_TEXT[accent])}>{session.type}</span>
            {session.moduleCode && <span className="font-mono text-[11px] text-on-surface-variant">{session.moduleCode}</span>}
          </div>
          <p className="text-sm text-on-surface">{session.moduleName}</p>
          <p className="text-xs text-on-surface-variant">{sessionMeta(session)}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className={microLabel}>Readings</span>
          <span className="text-[11px] tabular-nums text-on-surface-variant">
            {readings.length > 0 ? `${done}/${readings.length} done` : PREP_LABEL[status]}
          </span>
        </div>

        {loading ? (
          <p className="text-xs text-on-surface-variant">Loading…</p>
        ) : (
          readings.length > 0 && (
            <ul className="flex flex-col">
              {readings.map((link) => (
                <ReadingRow
                  key={link.id}
                  link={link}
                  accent={accent}
                  autoEdit={link.id === justAddedId}
                  onToggle={() => onToggleReading(link)}
                  onRename={(title) => onRenameReading(link.id, title)}
                  onRemove={() => onRemoveReading(link.id)}
                />
              ))}
            </ul>
          )
        )}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input
            size="sm"
            accent={accent}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a reading link (Talis, Blackboard…)"
            aria-label="Reading link"
          />
          <Button type="submit" size="sm" variant="outline" accent={accent} disabled={!url.trim() || adding}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add
          </Button>
        </form>

        {readings.length === 0 && !loading && (
          <label className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Tick
              checked={state.noReadings}
              label="No readings for this session"
              accent={accent}
              onToggle={() => onSaveState({ no_readings: !state.noReadings })}
            />
            No readings for this session
          </label>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-outline-variant/50 pt-3">
        <span className={microLabel}>After the session</span>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <Tick
            checked={state.notesDone}
            label={state.notesDone ? 'Mark notes not taken' : 'Mark notes taken'}
            accent={accent}
            onToggle={() => onSaveState({ notes_done_at: state.notesDone ? null : new Date().toISOString() })}
          />
          Notes taken
        </label>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            const next = noteDraft.trim() || null
            if (next !== (state.note ?? null)) onSaveState({ note: next })
          }}
          rows={2}
          placeholder="A line to remember (saved when you click away)"
          aria-label="Session note"
          className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-outline focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}

      {workspaceHref && (
        <Link
          href={workspaceHref}
          className={cn('flex items-center gap-1 self-end text-xs font-semibold hover:underline', ACCENT_TEXT[accent])}
        >
          Open module workspace
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      )}
    </div>
  )
}
