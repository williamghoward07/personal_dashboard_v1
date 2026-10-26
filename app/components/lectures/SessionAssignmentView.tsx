'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, ListChecks, Lock, NotebookPen, Sparkles } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { looksLikeUrl } from '@/lib/utils/url'
import { usePageTitle } from '@/lib/page-title'
import { useTimetable } from '@/lib/lectures/use-timetable'
import { useSessionPrep } from '@/lib/lectures/use-session-prep'
import { useSessionTasks } from '@/lib/lectures/use-session-tasks'
import type { SessionTask, WorkspaceLink } from '@/lib/types'
import {
  POST_LABEL,
  PREP_LABEL,
  hasEnded,
  isOverdue,
  postStatus,
  prepStatus,
  type SessionWithPrep,
} from '@/lib/timetable/session'
import { formatSessionDay, sessionMeta } from '@/lib/timetable/format'
import PrepLight from './PrepLight'
import HandInButton from './HandInButton'
import { AddForm, ItemRow, Tick, microLabel, readingItem, taskItem, type PrepItem } from './SessionPrepPanel'

const ACCENT = 'orange'

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode
  title: string
  count?: string
  children: ReactNode
}) {
  return (
    <ModuleGlassCard accent={ACCENT} size="sm" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          {icon}
          {title}
        </h2>
        {count && <span className="text-[11px] tabular-nums text-on-surface-variant">{count}</span>}
      </div>
      {children}
    </ModuleGlassCard>
  )
}

function StatusLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-right text-on-surface">{children}</span>
    </div>
  )
}

const ratio = (items: { done: boolean }[]) => `${items.filter((i) => i.done).length}/${items.length}`

/** The loaded view: one session's notes, readings and tasks, handed in from the top right. */
function AssignmentBody({ session }: { session: SessionWithPrep }) {
  const prep = useSessionPrep(session)
  const tasks = useSessionTasks(session.uid)
  const [now] = useState(() => new Date())
  const [noteDraft, setNoteDraft] = useState(prep.state?.note ?? session.note ?? '')
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  // Follow the saved note once it loads or changes elsewhere
  // (adjust-during-render, not an effect).
  const savedNote = prep.loading ? session.note : (prep.state?.note ?? null)
  const [syncedNote, setSyncedNote] = useState(savedNote)
  if (savedNote !== syncedNote) {
    setSyncedNote(savedNote)
    setNoteDraft(savedNote ?? '')
  }

  const loading = prep.loading || tasks.loading
  const prepDone = prep.loading ? session.prepDone : !!prep.state?.prep_done_at
  const notesDone = prep.loading ? session.notesDone : !!prep.state?.notes_done_at

  const prepTasks = tasks.tasks.filter((t) => t.phase === 'prep')
  const concepts = tasks.tasks.filter((t) => t.phase === 'post')
  // A task with a link is a reading, so it sits with the workspace readings.
  const readings: PrepItem[] = [...prep.readings.map(readingItem), ...prepTasks.filter((t) => t.url).map(taskItem)]
  const todo: PrepItem[] = prepTasks.filter((t) => !t.url).map(taskItem)
  const conceptItems = concepts.map(taskItem)

  const all = [...readings, ...todo]
  const status = prepStatus({ done: all.filter((i) => i.done).length, total: all.length }, prepDone)
  const ended = hasEnded(session, now)
  const post = postStatus(
    { done: concepts.filter((t) => t.done_at).length, total: concepts.length },
    notesDone,
    prepDone,
    ended
  )
  const overdue = isOverdue({ ...session, status }, now)
  const workspaceId = prep.readings[0]?.workspace_id ?? session.workspaceId

  const linkById = new Map(prep.readings.map((l) => [l.id, l]))
  const taskById = new Map(tasks.tasks.map((t) => [t.id, t]))
  const toggleTask = (task: SessionTask) =>
    void tasks.updateTask(task.id, { done_at: task.done_at ? null : new Date().toISOString() })
  const toggleLink = (link: WorkspaceLink) => void prep.toggleReading(link)

  const renderItem = (item: PrepItem) => {
    const link = linkById.get(item.id)
    const task = link ? null : taskById.get(item.id)
    return (
      <ItemRow
        key={item.key}
        item={item}
        accent={ACCENT}
        autoEdit={item.id === justAddedId}
        onToggle={() => (link ? toggleLink(link) : task && toggleTask(task))}
        onRename={(title) => void (link ? prep.renameReading(item.id, title) : tasks.updateTask(item.id, { title }))}
        onSetUrl={link ? undefined : (url) => void tasks.updateTask(item.id, { url })}
        onRemove={() => void (link ? prep.removeReading(item.id) : tasks.removeTask(item.id))}
      />
    )
  }

  // A module session files a pasted link in its workspace; anything else
  // keeps it as a task with a link.
  const addReading = async (url: string) => {
    const created = session.moduleCode ? await prep.addReading(url) : await tasks.addTask('prep', { url })
    if (created) setJustAddedId(created.id)
    return !!created
  }
  const addTask = async (text: string) => (looksLikeUrl(text) ? addReading(text) : !!(await tasks.addTask('prep', { title: text })))

  const saveNote = () => {
    const next = noteDraft.trim() || null
    if (next !== (prep.state?.note ?? null)) void prep.saveState({ note: next })
  }

  const error = prep.error ?? tasks.error

  return (
    <>
      <header className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/lectures"
            className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} />
            Lectures
          </Link>
          <div className="flex items-center gap-2">
            <PrepLight status={status} postStatus={post} />
            <span className="text-sm font-semibold text-academic-orange">{session.type}</span>
            {session.moduleCode && <span className="font-mono text-[11px] text-on-surface-variant">{session.moduleCode}</span>}
          </div>
          <h1 className="font-display text-headline-lg font-bold text-on-surface">{session.moduleName}</h1>
          <p className="text-sm text-on-surface-variant">{sessionMeta(session)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-5">
          {prepDone ? (
            <StatusBadge accent="mint" dot>
              Done{prep.state?.prep_done_at ? ` ${formatSessionDay(prep.state.prep_done_at)}` : ''}
            </StatusBadge>
          ) : overdue ? (
            <StatusBadge accent="crimson" dot>
              Overdue
            </StatusBadge>
          ) : (
            <StatusBadge accent="amber" dot>
              Not handed in
            </StatusBadge>
          )}
          <HandInButton prepDone={prepDone} accent={ACCENT} size="md" onSaveState={(patch) => void prep.saveState(patch)} />
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">
          <Section icon={<NotebookPen className="h-4 w-4 text-academic-orange" strokeWidth={1.75} />} title="Notes">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              rows={6}
              placeholder="Notes for this session (saved when you click away)"
              aria-label="Session notes"
              className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-outline focus:outline-none"
            />
          </Section>

          <Section
            icon={<BookOpen className="h-4 w-4 text-academic-orange" strokeWidth={1.75} />}
            title="Readings"
            count={readings.length > 0 ? `${ratio(readings)} read` : undefined}
          >
            {loading ? (
              <p className="text-xs text-on-surface-variant">Loading…</p>
            ) : readings.length > 0 ? (
              <ul className="flex flex-col">{readings.map(renderItem)}</ul>
            ) : (
              <p className="text-xs text-on-surface-variant">No readings yet.</p>
            )}
            <AddForm accent={ACCENT} placeholder="Paste a reading link" label="Add a reading" onAdd={addReading} />
          </Section>

          <Section
            icon={<ListChecks className="h-4 w-4 text-academic-orange" strokeWidth={1.75} />}
            title="Tasks"
            count={todo.length > 0 ? `${ratio(todo)} done` : undefined}
          >
            {loading ? (
              <p className="text-xs text-on-surface-variant">Loading…</p>
            ) : todo.length > 0 ? (
              <ul className="flex flex-col">{todo.map(renderItem)}</ul>
            ) : (
              <p className="text-xs text-on-surface-variant">No tasks yet.</p>
            )}
            <AddForm accent={ACCENT} placeholder="Add a task before the session" label="Add a task" onAdd={addTask} />
          </Section>

          {prepDone && (
            <Section
              icon={<Sparkles className="h-4 w-4 text-academic-orange" strokeWidth={1.75} />}
              title="Follow-up"
              count={concepts.length > 0 && !notesDone ? `${ratio(conceptItems)} reviewed` : POST_LABEL[post]}
            >
              {conceptItems.length > 0 && <ul className="flex flex-col">{conceptItems.map(renderItem)}</ul>}
              <AddForm
                accent={ACCENT}
                placeholder="A concept to look into"
                label="Add a concept to review"
                onAdd={async (text) => !!(await tasks.addTask('post', { title: text }))}
              />
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <Tick
                  checked={notesDone}
                  label={notesDone ? 'Mark follow-up not done' : 'Mark follow-up done'}
                  accent={ACCENT}
                  onToggle={() => void prep.saveState({ notes_done_at: notesDone ? null : new Date().toISOString() })}
                />
                Done — nothing left to follow up
              </label>
            </Section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <ModuleGlassCard accent={ACCENT} size="sm" className="flex flex-col gap-2.5">
            <span className={microLabel}>Status</span>
            <StatusLine label="Prep">{PREP_LABEL[status]}</StatusLine>
            <StatusLine label="Readings">{readings.length > 0 ? `${ratio(readings)} read` : '—'}</StatusLine>
            <StatusLine label="Tasks">{todo.length > 0 ? `${ratio(todo)} done` : '—'}</StatusLine>
            <StatusLine label="Follow-up">{prepDone ? POST_LABEL[post] : 'After marking as done'}</StatusLine>
            {!prepDone && (
              <p className="flex items-start gap-1.5 border-t border-outline-variant/50 pt-2.5 text-xs text-on-surface-variant">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
                Prep only turns green when you mark it as done, and follow-up opens then. Follow-up has no due date.
              </p>
            )}
          </ModuleGlassCard>
          {workspaceId && (
            <Link
              href={`/workspaces/${workspaceId}`}
              className="flex items-center gap-1 self-end text-xs font-semibold text-academic-orange hover:underline"
            >
              Open module workspace
              <ArrowRight className="h-3 w-3" strokeWidth={2} />
            </Link>
          )}
        </aside>
      </div>
    </>
  )
}

// /lectures/session?uid=…: one timetable session as a Teams-style
// assignment — notes, readings and tasks, handed in with Mark as done
// (top right). Follow-up only appears once it's handed in. The session
// comes from the feed (it's never stored), so a Google event has no page.
export default function SessionAssignmentView({ uid }: { uid: string }) {
  const { sessions, loading, error } = useTimetable()
  const session = sessions.find((s) => s.uid === uid) ?? null
  usePageTitle(session ? `${session.moduleCode ?? session.moduleName} ${session.type}` : undefined)

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      {session ? (
        <AssignmentBody key={session.uid} session={session} />
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href="/lectures"
            className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} />
            Lectures
          </Link>
          <p className="text-sm text-on-surface-variant">
            {loading ? 'Loading…' : error ? "Couldn't load the timetable." : 'This session is no longer on the timetable.'}
          </p>
        </div>
      )}
    </main>
  )
}
