'use client'

import { Fragment, useMemo } from 'react'
import { CheckCircle2, Layers, Link2, Brain } from 'lucide-react'
import { StatTile } from '@/components/ui/stat-tile'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'
import { isOpenLink } from '@/lib/workspaces/completed'
import { recentLogShare, sourceCoupling, sourceFootprint, taskProgress } from '@/lib/workspaces/stats'
import { STAT_GRID_CLASS, type StatCardKey } from '@/lib/workspaces/layout'
import { logTimestamp } from './shared'

export default function WorkspaceStatCards({
  cards,
  links,
  todos,
  notes,
  linkTodos,
  timeCard,
}: {
  // Which cards to show, in order — see lib/workspaces/layout.ts
  // visibleStatCards (a card drops out when its section is hidden).
  cards: StatCardKey[]
  links: WorkspaceLink[]
  todos: Todo[]
  notes: WorkspaceNote[]
  linkTodos: WorkspaceLinkTodo[]
  /** The Study time card (StudyTimeCard) — built by the page, which owns its data. */
  timeCard?: React.ReactNode
}) {
  const tasks = useMemo(() => taskProgress(todos), [todos])
  const footprint = useMemo(() => sourceFootprint(links), [links])
  const openCount = useMemo(() => links.filter(isOpenLink).length, [links])
  const coupling = useMemo(() => sourceCoupling(todos, linkTodos), [todos, linkTodos])
  const logShare = useMemo(() => recentLogShare(notes), [notes])
  const latest = notes[0]?.created_at ?? null

  if (cards.length === 0) return null

  const rendered: Record<StatCardKey, React.ReactNode> = {
    time: timeCard ?? null,
    tasks: (
      <StatTile
        label="Task progress"
        value={`${tasks.percent}%`}
        detail={todos.length === 0 ? 'No scoped actions yet' : `${tasks.completed} of ${todos.length} done`}
        percent={tasks.percent}
        accent="ws"
        icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />}
        ringTitle="Share of this workspace's scoped actions completed"
      />
    ),
    footprint: (
      <StatTile
        label="Working set footprint"
        value={String(openCount)}
        unit={openCount === 1 ? 'Source' : 'Sources'}
        detail={footprint.breakdown || 'No sources yet'}
        percent={footprint.percent}
        accent="ws"
        icon={<Layers className="h-5 w-5" strokeWidth={1.75} />}
        ringTitle="Share of sources with a type assigned"
      />
    ),
    coupling: (
      <StatTile
        label="Source coupling"
        value={`${coupling.percent}%`}
        detail={
          todos.length === 0
            ? 'No scoped actions yet'
            : `${coupling.coupled} of ${todos.length} tasks linked to a source`
        }
        percent={coupling.percent}
        accent="ws"
        icon={<Link2 className="h-5 w-5" strokeWidth={1.75} />}
        ringTitle="Share of scoped actions attached to at least one source"
      />
    ),
    log: (
      <StatTile
        label="Thinking log"
        value={String(notes.length)}
        unit={notes.length === 1 ? 'Entry' : 'Entries'}
        detail={latest ? `Latest ${logTimestamp(latest)}` : 'Nothing logged yet'}
        percent={logShare}
        accent="ws"
        icon={<Brain className="h-5 w-5" strokeWidth={1.75} />}
        ringTitle="Share of log entries written in the last 7 days"
      />
    ),
  }

  return (
    <div className={`grid grid-cols-1 gap-4 ${STAT_GRID_CLASS[cards.length]}`}>
      {cards.map((card) => (
        <Fragment key={card}>{rendered[card]}</Fragment>
      ))}
    </div>
  )
}
