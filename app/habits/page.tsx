import { BookOpen, Sparkles, Footprints, Dumbbell } from 'lucide-react'
import HabitCard from '../components/widgets/habits/HabitCard'

const HABITS = [
  {
    name: 'Reading',
    description: 'Read for at least 15 minutes',
    icon: BookOpen,
    color: '#9085e9',
    seed: 1,
    fillRate: 0.68,
    doneToday: true,
  },
  {
    name: 'Meditation',
    description: 'Meditate daily',
    icon: Sparkles,
    color: '#d55181',
    seed: 2,
    fillRate: 0.5,
    doneToday: false,
  },
  {
    name: 'Running',
    description: 'Go for a run every other day',
    icon: Footprints,
    color: '#199e70',
    seed: 3,
    fillRate: 0.42,
    doneToday: true,
  },
  {
    name: 'Gym session',
    description: 'Strength training, 3x a week',
    icon: Dumbbell,
    color: '#c98500',
    seed: 4,
    fillRate: 0.35,
    doneToday: false,
  },
] as const

export default function HabitsPage() {
  return (
    <main
      className="flex-1 px-8 py-6"
      style={{ backgroundColor: '#0b0f1a' }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <h1 className="text-xl font-semibold text-white">Habit tracker</h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {HABITS.map((habit) => (
            <HabitCard key={habit.name} {...habit} />
          ))}
        </div>
      </div>
    </main>
  )
}
