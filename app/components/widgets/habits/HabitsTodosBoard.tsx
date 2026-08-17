'use client'

import { useState } from 'react'
import { ListChecks, ListTodo } from 'lucide-react'
import HabitBoard from './HabitBoard'
import TodosBoard from '../daily-goals/TodosBoard'

type Tab = 'habits' | 'todos'

const TABS: { id: Tab; label: string; icon: typeof ListChecks; activeClass: string }[] = [
  { id: 'habits', label: 'Habits', icon: ListChecks, activeClass: 'text-habit-purple' },
  { id: 'todos', label: 'Todos', icon: ListTodo, activeClass: 'text-on-surface' },
]

export default function HabitsTodosBoard({ defaultTab }: { defaultTab: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div role="tablist" aria-label="Habits and todos" className="inline-flex w-fit items-center gap-1 rounded-xl bg-surface-container p-1">
        {TABS.map(({ id, label, icon: Icon, activeClass }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={active}
              aria-controls={`panel-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-display text-sm font-semibold transition-colors duration-200 ${
                active
                  ? `bg-surface-container-high ${activeClass}`
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        })}
      </div>

      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'habits' ? <HabitBoard /> : <TodosBoard />}
      </div>
    </main>
  )
}
