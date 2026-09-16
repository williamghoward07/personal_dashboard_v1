'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, Check, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp, Person } from '@/lib/types'
import { onActivateKey } from '@/lib/utils/a11y'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import FollowUpFormModal from './FollowUpFormModal'
import type { RunMutation } from './shared'
import { formatDate } from './shared'

/**
 * The point of the whole module: things you said you'd raise next time —
 * either noted while logging a conversation, or set directly as a
 * standalone reminder with no conversation to log yet.
 * Open items first, earliest-due first; recently-closed ones stay visible
 * so a mis-tick is undoable. Clicking an open item jumps straight to that
 * person's detail view.
 */
export default function FollowUpsCard({
  people,
  followUps,
  loading,
  runMutation,
  onChange,
}: {
  people: Person[]
  followUps: FollowUp[]
  loading: boolean
  runMutation: RunMutation
  onChange: () => void
}) {
  const router = useRouter()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editing, setEditing] = useState<FollowUp | null>(null)
  const [deleting, setDeleting] = useState<FollowUp | null>(null)

  const personName = (personId: string) => people.find((p) => p.id === personId)?.full_name ?? 'Unknown'

  const open = followUps
    .filter((f) => f.completed_at === null)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
  const done = followUps.filter((f) => f.completed_at !== null).slice(0, 3)

  const setCompleted = async (followUp: FollowUp, isDone: boolean) => {
    const ok = await runMutation(() =>
      supabase
        .from('follow_ups')
        .update({ completed_at: isDone ? new Date().toISOString() : null })
        .eq('id', followUp.id),
    )
    if (ok) onChange()
  }

  const openPerson = (personId: string) => router.push(`/people?person=${personId}`)

  return (
    <>
      <WidgetCard
        title="Bring up next time"
        accent="amber"
        icon={<BellRing className="h-4 w-4" />}
        className="sm:col-span-2 xl:col-span-2"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add follow-up"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-people-amber"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : followUps.length === 0 ? (
          <p>
            Nothing to follow up. Set a reminder from Quick add, or add a &ldquo;bring up next
            time&rdquo; note when you log a conversation, and it&apos;ll appear here.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {open.length === 0 ? (
              <p>All caught up.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {open.map((followUp) => (
                  <li
                    key={followUp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPerson(followUp.person_id)}
                    onKeyDown={onActivateKey(() => openPerson(followUp.person_id))}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-people-amber/30 bg-people-amber/5 p-2 hover:border-people-amber/50"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCompleted(followUp, true)
                      }}
                      aria-label={`Mark "${followUp.note}" as done`}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-people-amber/50 text-transparent hover:bg-people-amber/20 hover:text-people-amber"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm text-on-surface">{followUp.note}</span>
                      <span className="truncate text-xs text-on-surface-variant">
                        {personName(followUp.person_id)}
                        {followUp.due_date && <> · Due {formatDate(followUp.due_date)}</>}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(followUp)
                      }}
                      aria-label={`Edit "${followUp.note}"`}
                      className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(followUp)
                      }}
                      aria-label={`Delete "${followUp.note}"`}
                      className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {done.length > 0 && (
              <ul className="flex flex-col gap-1.5 border-t border-outline-variant pt-2">
                {done.map((followUp) => (
                  <li key={followUp.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-on-surface-variant line-through">
                      {followUp.note}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompleted(followUp, false)}
                      aria-label={`Reopen "${followUp.note}"`}
                      className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Undo2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(followUp)}
                      aria-label={`Delete "${followUp.note}"`}
                      className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </WidgetCard>

      <FollowUpFormModal
        isOpen={isAddOpen}
        heading="New follow-up"
        people={people}
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          const ok = await runMutation(() => supabase.from('follow_ups').insert(values))
          if (ok) {
            setIsAddOpen(false)
            onChange()
          }
        }}
      />

      <FollowUpFormModal
        isOpen={editing !== null}
        heading="Edit follow-up"
        people={people}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (!editing) return
          const ok = await runMutation(() => supabase.from('follow_ups').update(values).eq('id', editing.id))
          if (ok) {
            setEditing(null)
            onChange()
          }
        }}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        message={`Delete "${deleting?.note}"? This can't be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          const ok = await runMutation(() => supabase.from('follow_ups').delete().eq('id', deleting.id))
          if (ok) {
            setDeleting(null)
            onChange()
          }
        }}
      />
    </>
  )
}
