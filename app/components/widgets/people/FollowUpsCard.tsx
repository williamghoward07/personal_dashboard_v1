'use client'

import { BellRing, Check, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp, Person } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import type { RunMutation } from './shared'
import { formatDate } from './shared'

/**
 * The point of the whole module: things you said you'd raise next time —
 * either noted while logging a conversation, or set directly as a
 * standalone reminder with no conversation to log yet.
 * Open items first, earliest-due first; recently-closed ones stay visible
 * so a mis-tick is undoable.
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
  const personName = (personId: string) => people.find((p) => p.id === personId)?.full_name ?? 'Unknown'

  const open = followUps
    .filter((f) => !f.done)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
  const done = followUps.filter((f) => f.done).slice(0, 3)

  const setDone = async (followUp: FollowUp, isDone: boolean) => {
    const ok = await runMutation(() => supabase.from('follow_ups').update({ done: isDone }).eq('id', followUp.id))
    if (ok) onChange()
  }

  return (
    <WidgetCard
      title="Bring up next time"
      accent="amber"
      icon={<BellRing className="h-4 w-4" />}
      className="sm:col-span-2 xl:col-span-2"
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
                  className="flex items-start gap-2 rounded-lg border border-people-amber/30 bg-people-amber/5 p-2"
                >
                  <button
                    type="button"
                    onClick={() => setDone(followUp, true)}
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
                    onClick={() => setDone(followUp, false)}
                    aria-label={`Reopen "${followUp.note}"`}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <Undo2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </WidgetCard>
  )
}
