import type { Task } from '@/lib/types'

export type RiskLevel = 'high' | 'medium' | 'low'

export interface TaskRisk {
  task: Task
  daysUntilDue: number
  minutesLogged: number
  riskLevel: RiskLevel
}

const HIGH_RISK_DAYS = 3
const MEDIUM_RISK_DAYS = 7
const LOW_PROGRESS_MINUTES = 60

// Returns null for tasks that shouldn't be flagged at all: no due date,
// already done, or overdue (overdue tasks belong in a different nudge,
// not a countdown).
export function computeTaskRisk(
  task: Task,
  minutesLogged: number,
  today: string
): TaskRisk | null {
  if (!task.due_date || task.status === 'Done') return null

  const daysUntilDue = Math.ceil(
    (new Date(task.due_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysUntilDue < 0) return null

  let riskLevel: RiskLevel = 'low'
  if (daysUntilDue <= HIGH_RISK_DAYS && minutesLogged < LOW_PROGRESS_MINUTES) {
    riskLevel = 'high'
  } else if (daysUntilDue <= MEDIUM_RISK_DAYS && minutesLogged < LOW_PROGRESS_MINUTES) {
    riskLevel = 'medium'
  }

  return { task, daysUntilDue, minutesLogged, riskLevel }
}
