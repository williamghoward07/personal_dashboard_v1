import Link from 'next/link'
import HabitBoard from './HabitBoard'
import TodosBoard from '../daily-goals/TodosBoard'

type Tab = 'habits' | 'todos'

export default function HabitsTodosBoard({ defaultTab }: { defaultTab: Tab }) {
  const tabs = (
    <nav aria-label="Tasks and habits" className="inline-flex w-fit rounded-lg border border-outline-variant p-1 text-sm font-semibold">
      <Link href="/todos" aria-current={defaultTab === 'todos' ? 'page' : undefined} className={`rounded-md px-4 py-2 ${defaultTab === 'todos' ? 'bg-[#e2ecd6] text-[#283b20]' : 'text-on-surface-variant'}`}>Todos</Link>
      <Link href="/habits" aria-current={defaultTab === 'habits' ? 'page' : undefined} className={`rounded-md px-4 py-2 ${defaultTab === 'habits' ? 'bg-[#e2ecd6] text-[#283b20]' : 'text-on-surface-variant'}`}>Habits</Link>
    </nav>
  )

  return (
    <main className="mx-auto flex w-full max-w-360 min-w-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6">
      {defaultTab === 'habits' ? <>{tabs}<HabitBoard /></> : <TodosBoard tabs={tabs} />}
    </main>
  )
}
