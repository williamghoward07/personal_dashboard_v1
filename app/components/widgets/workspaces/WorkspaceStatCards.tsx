'use client'

import { useMemo } from 'react'
import { CheckCircle2, Layers, Link2, Brain } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { ProgressRing } from '@/components/ui/progress-ring'
import type { Todo, WorkspaceLink, WorkspaceLinkTodo, WorkspaceNote } from '@/lib/types'
import { recentLogShare, sourceCoupling, sourceFootprint, taskProgress } from '@/lib/workspaces/stats'
import { logTimestamp, microLabelClass } from './shared'

function StatCard({
  label,
  value,
  unit,
  detail,
  percent,
  Icon,
  ringTitle,
}: {
  label: string
  value: string
  unit?: string
  detail: string
  percent: number
  Icon: LucideIcon
  ringTitle: string
}) {
  return (
    <ModuleGlassCard accent="teal" size="sm" className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={microLabelClass}>{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-headline-lg font-bold tabular-nums text-on-surface">{value}</span>
          {unit && <span className="text-xs text-on-surface-variant">{unit}</span>}
        </span>
        <span className="truncate text-xs text-on-surface-variant">{detail}</span>
      </div>
      <div title={ringTitle}>
        <ProgressRing
          accent="teal"
          value={percent}
          size="md"
          showValue
          formatValue={() => <Icon className="h-4 w-4 text-workspace-teal" strokeWidth={1.75} />}
        />
      </div>
    </ModuleGlassCard>
  )
}

export default function WorkspaceStatCards({
  links,
  todos,
  notes,
  linkTodos,
}: {
  links: WorkspaceLink[]
  todos: Todo[]
  notes: WorkspaceNote[]
  linkTodos: WorkspaceLinkTodo[]
}) {
  const tasks = useMemo(() => taskProgress(todos), [todos])
  const footprint = useMemo(() => sourceFootprint(links), [links])
  const coupling = useMemo(() => sourceCoupling(todos, linkTodos), [todos, linkTodos])
  const logShare = useMemo(() => recentLogShare(notes), [notes])
  const latest = notes[0]?.created_at ?? null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Task progress"
        value={`${tasks.percent}%`}
        detail={todos.length === 0 ? 'No scoped actions yet' : `${tasks.completed} of ${todos.length} done`}
        percent={tasks.percent}
        Icon={CheckCircle2}
        ringTitle="Share of this workspace's scoped actions completed"
      />

      <StatCard
        label="Working set footprint"
        value={String(links.length)}
        unit={links.length === 1 ? 'Source' : 'Sources'}
        detail={footprint.breakdown || 'No sources yet'}
        percent={footprint.percent}
        Icon={Layers}
        ringTitle="Share of sources with a type assigned"
      />

      <StatCard
        label="Source coupling"
        value={`${coupling.percent}%`}
        detail={
          todos.length === 0
            ? 'No scoped actions yet'
            : `${coupling.coupled} of ${todos.length} tasks linked to a source`
        }
        percent={coupling.percent}
        Icon={Link2}
        ringTitle="Share of scoped actions attached to at least one source"
      />

      <StatCard
        label="Thinking log"
        value={String(notes.length)}
        unit={notes.length === 1 ? 'Entry' : 'Entries'}
        detail={latest ? `Latest ${logTimestamp(latest)}` : 'Nothing logged yet'}
        percent={logShare}
        Icon={Brain}
        ringTitle="Share of log entries written in the last 7 days"
      />
    </div>
  )
}
