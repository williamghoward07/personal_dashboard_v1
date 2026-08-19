'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Module, Task } from '@/lib/types'
import { computeTaskRisk, type TaskRisk } from '@/lib/education/deadline-risk'
import TaskDetailModal from './TaskDetailModal'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const RISK_STYLES: Record<'high' | 'medium', string> = {
  high: 'border-error/40 bg-error/10 text-error',
  medium: 'border-academic-orange/40 bg-academic-orange/10 text-academic-orange',
}

interface TimeLogMinutes {
  task_id: string
  minutes_spent: number
}

// Always visible regardless of the Modules/Tasks toggle — a countdown of
// what's close to due with little logged progress, complementary to
// whichever browsing view is active.
export default function AtRiskTasks({ modules }: { modules: Module[] }) {
  const [risks, setRisks] = useState<TaskRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)

  const moduleIds = modules.map((m) => m.id)
  const moduleIdsKey = moduleIds.join(',')

  useEffect(() => {
    if (moduleIds.length === 0) {
      setRisks([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('tasks')
      .select('*')
      .in('module_id', moduleIds)
      .not('due_date', 'is', null)
      .then(async ({ data }) => {
        const tasks = (data ?? []) as Task[]
        const taskIds = tasks.map((t) => t.id)
        const { data: logRows } = taskIds.length
          ? await supabase.from('time_logs').select('task_id, minutes_spent').in('task_id', taskIds)
          : { data: [] as TimeLogMinutes[] }

        const minutesByTask = new Map<string, number>()
        for (const row of (logRows ?? []) as TimeLogMinutes[]) {
          minutesByTask.set(row.task_id, (minutesByTask.get(row.task_id) ?? 0) + row.minutes_spent)
        }

        const today = todayISO()
        const computed = tasks
          .map((t) => computeTaskRisk(t, minutesByTask.get(t.id) ?? 0, today))
          .filter((r): r is TaskRisk => r !== null && r.riskLevel !== 'low')
          .sort((a, b) => a.daysUntilDue - b.daysUntilDue)

        setRisks(computed)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIdsKey])

  if (loading || risks.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-on-surface">
        <AlertTriangle className="h-4 w-4 text-academic-orange" />
        At risk
      </h3>
      <div className="flex flex-col gap-1.5">
        {risks.map((r) => (
          <button
            key={r.task.id}
            type="button"
            onClick={() => setViewingTask(r.task)}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-sm ${RISK_STYLES[r.riskLevel as 'high' | 'medium']}`}
          >
            <span className="truncate">{r.task.title || 'Untitled task'}</span>
            <span className="shrink-0 text-xs">
              {r.daysUntilDue === 0 ? 'Due today' : `${r.daysUntilDue}d left`} ·{' '}
              {r.minutesLogged}m logged
            </span>
          </button>
        ))}
      </div>

      {viewingTask && <TaskDetailModal task={viewingTask} onClose={() => setViewingTask(null)} />}
    </div>
  )
}
