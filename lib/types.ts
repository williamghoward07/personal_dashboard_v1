export interface Year {
  id: string
  name: string
  start_date: string | null
  created_at: string
}

export interface Module {
  id: string
  year_id: string
  name: string
  created_at: string
}

export interface Task {
  id: string
  module_id: string
  title: string
  type: string | null
  due_date: string | null
  credit_weight: number | null
  status: string | null
  grade: string | null
  notes: string | null
  description: string | null
  created_at: string
}

export interface Topic {
  id: string
  module_id: string
  name: string
  confidence: number | null
  created_at: string
}

export interface Prompt {
  id: string
  title: string
  prompt: string
  created_at: string
}

export interface PerplexityLink {
  id: string
  url: string
  title: string
  folder: string
  created_at: string
}

export interface TaskResearchLink {
  id: string
  task_id: string
  prompt_id: string | null
  perplexity_link_id: string | null
  created_at: string
}

export type HabitFrequencyType = 'daily' | 'weekly'

export interface Habit {
  id: string
  name: string
  icon: string
  description: string
  color: string
  frequency_type: HabitFrequencyType
  frequency_count: number
  is_quantifiable: boolean
  target_value: number | null
  unit: string | null
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  date: string
  completed: boolean
  value: number | null
  created_at: string
}

export interface RugbySession {
  id: string
  date: string
  duration_minutes: number | null
  notes: string | null
  created_at: string
}

export interface TimeLog {
  id: string
  task_id: string
  date: string
  minutes_spent: number
  created_at: string
}

export type TransactionType = 'income' | 'outgoing'

export interface Transaction {
  id: string
  date: string
  amount: number
  category: string
  description: string | null
  type: TransactionType
  created_at: string
}
