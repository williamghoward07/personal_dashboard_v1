'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Settings2, Sunrise } from 'lucide-react'
import type { HabitStep, HabitStepCheck, DailyGoalHabitCompletion } from '@/lib/types'
import { useStoredIdSet } from '@/lib/utils/use-stored-id-set'
import { useMorningRoutines, type RoutineData } from '@/lib/habits/use-morning-routines'
import {
  checkedStepIds,
  dayComplete,
  missedLastTwo,
  routineWeekStatus,
  splitSteps,
  weekStatusLabel,
} from '@/lib/habits/steps'
import WidgetCard from '../../WidgetCard'
import MorningRoutineSetupModal from '../habits/MorningRoutineSetupModal'

const DISMISSED_KEY = 'home:dismissed-cards'
const SETUP_CARD_ID = 'morning-routine-setup'

function StepRow({ step, checked, onToggle }: { step: HabitStep; checked: boolean; onToggle: () => void }) {
  const inputId = `routine-step-${step.id}`
  return (
    <li className="flex items-center gap-2">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-outline-variant bg-transparent checked:border-habit-purple checked:bg-habit-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-habit-purple/50"
      />
      <label
        htmlFor={inputId}
        className={`min-w-0 flex-1 cursor-pointer truncate text-sm ${
          checked ? 'text-on-surface-variant line-through' : 'text-on-surface'
        }`}
      >
        {step.title}
      </label>
    </li>
  )
}

function WeekDots({ done, target }: { done: number; target: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${done} of ${target} this week`}>
      {Array.from({ length: target }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < done ? 'bg-habit-purple' : 'bg-surface-container-highest'}`}
        />
      ))}
    </span>
  )
}

function Routine({
  routine,
  showName,
  checks,
  completions,
  todayKey,
  weekStartKey,
  pastCutoff,
  onToggle,
}: {
  routine: RoutineData
  showName: boolean
  checks: HabitStepCheck[]
  completions: DailyGoalHabitCompletion[]
  todayKey: string
  weekStartKey: string
  pastCutoff: boolean
  onToggle: (step: HabitStep, checked: boolean) => void
}) {
  const [bonusOpen, setBonusOpen] = useState(false)
  const { habit, steps } = routine
  const { core, bonus } = splitSteps(steps)
  const checked = checkedStepIds(checks, todayKey)
  const doneToday =
    dayComplete(steps, checks, todayKey) || completions.some((c) => c.habit_id === habit.id && c.completed_on === todayKey)
  const week = routineWeekStatus(habit, completions, todayKey, weekStartKey)
  const nudge = !doneToday && week.state !== 'met' && missedLastTwo(habit, completions, todayKey)
  const firstUndone = core.find((s) => !checked.has(s.id))
  const bonusDone = bonus.filter((s) => checked.has(s.id)).length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {showName ? (
          <span className="truncate text-xs font-semibold text-on-surface">
            {habit.icon} {habit.name}
          </span>
        ) : (
          <span className="text-xs text-on-surface-variant">{doneToday ? 'Done for today' : 'Core steps'}</span>
        )}
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-on-surface-variant">
          <WeekDots done={week.done} target={week.target} />
          {week.done}/{week.target} this week
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {core.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            checked={checked.has(step.id)}
            onToggle={() => onToggle(step, !checked.has(step.id))}
          />
        ))}
      </ul>

      {bonus.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setBonusOpen((v) => !v)}
            aria-expanded={bonusOpen}
            className="flex w-fit items-center gap-1 text-[11px] text-on-surface-variant hover:text-on-surface"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${bonusOpen ? '' : '-rotate-90'}`} />
            Bonus ({bonusDone}/{bonus.length})
          </button>
          {bonusOpen && (
            <ul className="flex flex-col gap-1.5 pl-1">
              {bonus.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  checked={checked.has(step.id)}
                  onToggle={() => onToggle(step, !checked.has(step.id))}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-[11px] text-on-surface-variant">{weekStatusLabel(week)}</p>
      {nudge && (
        <p className="text-[11px] text-habit-purple">Missed the last two — don&apos;t make it three.</p>
      )}
      {!doneToday && pastCutoff && firstUndone && week.state !== 'met' && (
        <p className="text-[11px] text-on-surface-variant">
          Short on time? Minimum version: just <span className="text-on-surface">{firstUndone.title.toLowerCase()}</span>.
        </p>
      )}
    </div>
  )
}

// Home card for habits that have steps (the morning routine). Offers a
// one-time setup when there isn't one yet; "Not now" hides that offer in
// this browser (set one up later from Habits).
export default function MorningRoutineCard() {
  const { routines, checks, completions, loading, error, todayKey, weekStartKey, pastCutoff, toggleStep } =
    useMorningRoutines()
  const [dismissed, setDismissed] = useStoredIdSet(DISMISSED_KEY)
  const [setupOpen, setSetupOpen] = useState(false)

  const setupDismissed = dismissed.has(SETUP_CARD_ID)
  if (!loading && !error && routines.length === 0 && setupDismissed) return null

  const title = routines.length === 1 ? routines[0].habit.name : 'Morning routine'

  return (
    <WidgetCard
      title={title}
      accent="purple"
      icon={<Sunrise className="h-4 w-4" />}
      action={
        routines.length > 0 ? (
          <Link
            href="/habits"
            aria-label="Edit routine steps on the Habits page"
            title="Edit steps (Habits → edit habit)"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <ul className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-5 animate-pulse rounded bg-surface-container-high" />
          ))}
        </ul>
      ) : error && routines.length === 0 ? (
        <p className="text-xs">Couldn&apos;t load your routine. Has the habit steps migration been run?</p>
      ) : routines.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs">
            A small routine you can do even on a packed uni morning: one to three core steps that count, bonus steps
            when there&apos;s time, and a weekly target instead of a perfect streak.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="rounded-lg bg-habit-purple px-3 py-1.5 text-xs font-medium text-surface-container-lowest hover:brightness-110"
            >
              Set it up
            </button>
            <button
              type="button"
              onClick={() => setDismissed(new Set(dismissed).add(SETUP_CARD_ID))}
              className="rounded-lg px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high"
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine) => (
            <Routine
              key={routine.habit.id}
              routine={routine}
              showName={routines.length > 1}
              checks={checks}
              completions={completions}
              todayKey={todayKey}
              weekStartKey={weekStartKey}
              pastCutoff={pastCutoff}
              onToggle={(step, next) => void toggleStep(step, next)}
            />
          ))}
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}

      <MorningRoutineSetupModal isOpen={setupOpen} onClose={() => setSetupOpen(false)} />
    </WidgetCard>
  )
}
