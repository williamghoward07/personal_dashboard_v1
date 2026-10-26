'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ExternalLink, Link2, Maximize2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ACCENT_BAR, ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { looksLikeUrl } from '@/lib/utils/url'
import type { SessionTask, WorkspaceLink } from '@/lib/types'
import { POST_LABEL, PREP_LABEL, hasEnded, postStatus, prepStatus, type TimetableSession } from '@/lib/timetable/session'
import { sessionMeta } from '@/lib/timetable/format'
import type { SessionStatePatch } from '@/lib/lectures/prep-writes'
import type { SessionTaskPatch } from '@/lib/lectures/use-session-tasks'
import HandInButton from './HandInButton'
import PrepLight from './PrepLight'

export interface SessionPrepState {
  /** Handed in with Mark as done. */
  prepDone: boolean
  notesDone: boolean
  note: string | null
}

export const microLabel = 'font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/70'

export function Tick({ checked, label, accent, onToggle }: { checked: boolean; label: string; accent: UiAccent; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? cn('border-transparent text-surface-container-lowest', ACCENT_BAR[accent])
          : 'border-outline hover:border-on-surface-variant'
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
    </button>
  )
}

/** One prep item: a task, or a reading (anything with a link). */
export interface PrepItem {
  key: string
  id: string
  title: string
  url: string | null
  done: boolean
  /** Workspace readings always have a link; only tasks can gain or lose one. */
  linkEditable: boolean
}

export function ItemRow({
  item,
  accent,
  autoEdit,
  onToggle,
  onRename,
  onSetUrl,
  onRemove,
}: {
  item: PrepItem
  accent: UiAccent
  autoEdit: boolean
  onToggle: () => void
  onRename: (title: string) => void
  onSetUrl?: (url: string | null) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState<'title' | 'url' | null>(autoEdit ? 'title' : null)
  const [draft, setDraft] = useState(autoEdit ? item.title : '')

  const startEdit = (field: 'title' | 'url') => {
    setDraft(field === 'title' ? item.title : (item.url ?? ''))
    setEditing(field)
  }

  const commit = () => {
    const value = draft.trim()
    if (editing === 'title' && value && value !== item.title) onRename(value)
    if (editing === 'url' && value !== (item.url ?? '')) onSetUrl?.(value || null)
    setEditing(null)
  }

  return (
    <li className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-container-high/50">
      <Tick
        checked={item.done}
        label={item.done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
        accent={accent}
        onToggle={onToggle}
      />
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
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(null)
            }}
            aria-label={editing === 'title' ? 'Title' : 'Link (empty to remove)'}
            placeholder={editing === 'title' ? 'e.g. Harvey (1989) ch. 2' : 'Paste a link to make it a reading'}
          />
        </form>
      ) : item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 text-sm',
            item.done ? 'text-on-surface-variant line-through' : 'text-on-surface hover:underline'
          )}
        >
          <span className="truncate">{item.title}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-40" strokeWidth={1.75} aria-hidden />
        </a>
      ) : (
        <span className={cn('min-w-0 flex-1 truncate text-sm', item.done ? 'text-on-surface-variant line-through' : 'text-on-surface')}>
          {item.title}
        </span>
      )}
      {!editing && (
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {item.linkEditable && onSetUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              accent={accent}
              onClick={() => startEdit('url')}
              aria-label={item.url ? `Change the link for ${item.title}` : `Add a link to ${item.title}`}
              title={item.url ? 'Change link' : 'Add a link (makes it a reading)'}
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" accent={accent} onClick={() => startEdit('title')} aria-label={`Rename ${item.title}`}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
          <Button variant="destructive" size="icon-sm" onClick={onRemove} aria-label={`Remove ${item.title}`}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Button>
        </span>
      )}
    </li>
  )
}

export function AddForm({
  accent,
  placeholder,
  label,
  onAdd,
}: {
  accent: UiAccent
  placeholder: string
  label: string
  onAdd: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim() || adding) return
        setAdding(true)
        void onAdd(text.trim()).then((ok) => {
          if (ok) setText('')
          setAdding(false)
        })
      }}
    >
      <Input
        size="sm"
        accent={accent}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      <Button type="submit" size="sm" variant="outline" accent={accent} disabled={!text.trim() || adding}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Add
      </Button>
    </form>
  )
}

export const taskItem = (task: SessionTask): PrepItem => ({
  key: `task-${task.id}`,
  id: task.id,
  title: task.title,
  url: task.url,
  done: !!task.done_at,
  linkEditable: true,
})

export const readingItem = (link: WorkspaceLink): PrepItem => ({
  key: `link-${link.id}`,
  id: link.id,
  title: link.title,
  url: link.url,
  done: !!link.completed_at,
  linkEditable: false,
})

/**
 * Prep for one session, compact (the calendar popover). Before: tasks, any
 * of which becomes a reading once it has a link (pasting a link adds a
 * reading straight away), handed in with Mark as done. After (only once
 * handed in): concepts to review, or "done". Presentational — driven by
 * ConnectedSessionPrep. The full page is SessionAssignmentView.
 */
export default function SessionPrepPanel({
  session,
  readings,
  tasks,
  state,
  accent = 'orange',
  loading = false,
  error,
  workspaceHref,
  fullViewHref,
  showHeader = true,
  headerSlot,
  onAddReading,
  onToggleReading,
  onRenameReading,
  onRemoveReading,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onSaveState,
}: {
  session: Pick<TimetableSession, 'title' | 'type' | 'moduleName' | 'moduleCode' | 'start' | 'end' | 'location'>
  /** Readings filed in the module workspace. */
  readings: WorkspaceLink[]
  tasks: SessionTask[]
  state: SessionPrepState
  accent?: UiAccent
  loading?: boolean
  error?: string | null
  /** "Open module workspace" link; omitted when already on it. */
  workspaceHref?: string | null
  /** The session's assignment view. */
  fullViewHref?: string | null
  showHeader?: boolean
  /** Shown under the header (the calendar's "track prep" switch). */
  headerSlot?: ReactNode
  /** A pasted link. Returns the new item's id (to open it for renaming). */
  onAddReading: (rawUrl: string) => Promise<{ id: string } | null>
  onToggleReading: (link: WorkspaceLink) => void
  onRenameReading: (id: string, title: string) => void
  onRemoveReading: (id: string) => void
  onAddTask: (phase: SessionTask['phase'], title: string) => Promise<{ id: string } | null>
  onUpdateTask: (id: string, patch: SessionTaskPatch) => void
  onRemoveTask: (id: string) => void
  onSaveState: (patch: SessionStatePatch) => void
}) {
  const [noteDraft, setNoteDraft] = useState(state.note ?? '')
  // A link added here opens straight into rename: its title is only its
  // domain (durham.rl.talis.com), which says nothing.
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [now] = useState(() => new Date())

  // Follow the saved note when it changes elsewhere (adjust-during-render,
  // not an effect).
  const [syncedNote, setSyncedNote] = useState(state.note)
  if (state.note !== syncedNote) {
    setSyncedNote(state.note)
    setNoteDraft(state.note ?? '')
  }

  const prepTasks = tasks.filter((t) => t.phase === 'prep')
  const concepts = tasks.filter((t) => t.phase === 'post')
  const before: PrepItem[] = [...readings.map(readingItem), ...prepTasks.map(taskItem)]
  const readingIds = new Set(readings.map((r) => r.id))

  const prepDone = before.filter((i) => i.done).length
  const conceptsDone = concepts.filter((t) => t.done_at).length
  const status = prepStatus({ done: prepDone, total: before.length }, state.prepDone)
  const post = postStatus({ done: conceptsDone, total: concepts.length }, state.notesDone, state.prepDone, hasEnded(session, now))

  const toggleTask = (task: SessionTask) =>
    onUpdateTask(task.id, {
      done_at: task.done_at ? null : new Date().toISOString(),
    })

  const addBefore = async (text: string) => {
    if (looksLikeUrl(text)) {
      const created = await onAddReading(text)
      if (created) setJustAddedId(created.id)
      return !!created
    }
    return !!(await onAddTask('prep', text))
  }

  const renderItem = (item: PrepItem) => {
    const link = readingIds.has(item.id) ? readings.find((r) => r.id === item.id)! : null
    const task = link ? null : tasks.find((t) => t.id === item.id)!
    return (
      <ItemRow
        key={item.key}
        item={item}
        accent={accent}
        autoEdit={item.id === justAddedId}
        onToggle={() => (link ? onToggleReading(link) : toggleTask(task!))}
        onRename={(title) => (link ? onRenameReading(item.id, title) : onUpdateTask(item.id, { title }))}
        onSetUrl={link ? undefined : (url) => onUpdateTask(item.id, { url })}
        onRemove={() => (link ? onRemoveReading(item.id) : onRemoveTask(item.id))}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {showHeader && (
        <div className="flex flex-col gap-1 pr-6">
          <div className="flex items-center gap-2">
            <PrepLight status={status} postStatus={post} />
            <span className={cn('text-sm font-semibold', ACCENT_TEXT[accent])}>{session.type}</span>
            {session.moduleCode && <span className="font-mono text-[11px] text-on-surface-variant">{session.moduleCode}</span>}
          </div>
          <p className="text-sm text-on-surface">{session.moduleName}</p>
          <p className="text-xs text-on-surface-variant">{sessionMeta(session)}</p>
        </div>
      )}
      {headerSlot}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className={microLabel}>Before · tasks &amp; readings</span>
          <span className="text-[11px] tabular-nums text-on-surface-variant">
            {before.length > 0 && !state.prepDone ? `${prepDone}/${before.length} ticked` : PREP_LABEL[status]}
          </span>
        </div>

        {loading ? (
          <p className="text-xs text-on-surface-variant">Loading…</p>
        ) : (
          before.length > 0 && <ul className="flex flex-col">{before.map(renderItem)}</ul>
        )}

        <AddForm accent={accent} placeholder="Add a task, or paste a reading link" label="Add a task or reading" onAdd={addBefore} />

        {!loading && <HandInButton prepDone={state.prepDone} accent={accent} className="self-start" onSaveState={onSaveState} />}
      </div>

      <textarea
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => {
          const next = noteDraft.trim() || null
          if (next !== (state.note ?? null)) onSaveState({ note: next })
        }}
        rows={2}
        placeholder="Notes (saved when you click away)"
        aria-label="Session note"
        className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-outline focus:outline-none"
      />

      {state.prepDone && (
        <div className="flex flex-col gap-1.5 border-t border-outline-variant/50 pt-3">
          <div className="flex items-center justify-between">
            <span className={microLabel}>After · concepts to review</span>
            <span className="text-[11px] tabular-nums text-on-surface-variant">
              {concepts.length > 0 && !state.notesDone ? `${conceptsDone}/${concepts.length} reviewed` : POST_LABEL[post]}
            </span>
          </div>

          {!loading && concepts.length > 0 && <ul className="flex flex-col">{concepts.map((t) => renderItem(taskItem(t)))}</ul>}

          <AddForm
            accent={accent}
            placeholder="A concept to look into"
            label="Add a concept to review"
            onAdd={async (text) => !!(await onAddTask('post', text))}
          />

          <label className="flex items-center gap-2 text-sm text-on-surface">
            <Tick
              checked={state.notesDone}
              label={state.notesDone ? 'Mark follow-up not done' : 'Mark follow-up done'}
              accent={accent}
              onToggle={() =>
                onSaveState({
                  notes_done_at: state.notesDone ? null : new Date().toISOString(),
                })
              }
            />
            Done — nothing left to follow up
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}

      {(fullViewHref || workspaceHref) && (
        <div className="flex items-center justify-end gap-4">
          {fullViewHref && (
            <Link href={fullViewHref} className={cn('flex items-center gap-1 text-xs font-semibold hover:underline', ACCENT_TEXT[accent])}>
              <Maximize2 className="h-3 w-3" strokeWidth={2} />
              Open full view
            </Link>
          )}
          {workspaceHref && (
            <Link href={workspaceHref} className={cn('flex items-center gap-1 text-xs font-semibold hover:underline', ACCENT_TEXT[accent])}>
              Open module workspace
              <ArrowRight className="h-3 w-3" strokeWidth={2} />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
