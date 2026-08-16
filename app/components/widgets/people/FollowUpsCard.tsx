'use client'

import { BellRing, Check, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Interaction, InteractionPerson, Person } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import type { RunMutation } from './shared'
import { attendeeNames, formatDate } from './shared'

/**
 * The point of the whole module: things you said you'd raise next time.
 * Open items first; recently-closed ones stay visible so a mis-tick is undoable.
 */
export default function FollowUpsCard({
  people,
  interactions,
  links,
  loading,
  runMutation,
  onChange,
}: {
  people: Person[]
  interactions: Interaction[]
  links: InteractionPerson[]
  loading: boolean
  runMutation: RunMutation
  onChange: () => void
}) {
  const withFollowUp = interactions.filter((i) => i.follow_up)
  const open = withFollowUp.filter((i) => !i.follow_up_done)
  const done = withFollowUp.filter((i) => i.follow_up_done).slice(0, 3)

  const setDone = async (interaction: Interaction, followUpDone: boolean) => {
    const ok = await runMutation(() =>
      supabase
        .from('interactions')
        .update({ follow_up_done: followUpDone })
        .eq('id', interaction.id),
    )
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
      ) : withFollowUp.length === 0 ? (
        <p>
          Nothing to follow up. Add a &ldquo;bring up next time&rdquo; note when you log a
          conversation and it&apos;ll appear here.
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {open.length === 0 ? (
            <p>All caught up.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {open.map((interaction) => (
                <li
                  key={interaction.id}
                  className="flex items-start gap-2 rounded-lg border border-people-amber/30 bg-people-amber/5 p-2"
                >
                  <button
                    type="button"
                    onClick={() => setDone(interaction, true)}
                    aria-label={`Mark "${interaction.follow_up}" as done`}
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-people-amber/50 text-transparent hover:bg-people-amber/20 hover:text-people-amber"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-on-surface">{interaction.follow_up}</span>
                    <span className="truncate text-xs text-on-surface-variant">
                      {attendeeNames(interaction.id, links, people) || 'No one linked'} ·{' '}
                      {formatDate(interaction.occurred_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <ul className="flex flex-col gap-1.5 border-t border-outline-variant pt-2">
              {done.map((interaction) => (
                <li key={interaction.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-on-surface-variant line-through">
                    {interaction.follow_up}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDone(interaction, false)}
                    aria-label={`Reopen "${interaction.follow_up}"`}
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
