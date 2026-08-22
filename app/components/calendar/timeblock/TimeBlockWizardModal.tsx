'use client'

import { useEffect, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { EducationTask } from '@/lib/types'
import { connectGoogleCalendar } from '@/lib/google/connect'
import { londonDateKey, londonDateTimeToUTCISO } from '@/lib/google/london-day'
import { useTodos } from '@/lib/daily-goals/use-todos'
import { selectChecklistTodos } from '@/lib/daily-goals/checklist'
import { buildCandidateItems } from '@/lib/timeblock/candidates'
import { buildTimeBlockPlan } from '@/lib/timeblock/plan'
import { parseHHmm, resolveWindow, splitDayOffset } from '@/lib/timeblock/time'
import { readLastWakeBedtime, writeLastWakeBedtime } from '@/lib/timeblock/storage'
import { DEFAULT_BLOCK_MINUTES } from '@/lib/timeblock/constants'
import type { BusyInterval, KeyEventInput, TimeBlockCandidateItem } from '@/lib/timeblock/types'
import { addDaysToKey, formatTime } from '../calendarItems'
import type { CalendarEvent } from '../calendarItems'
import Modal from '../../Modal'
import TimeBlockStepInputs from './TimeBlockStepInputs'
import TimeBlockStepReview from './TimeBlockStepReview'
import type { TimeBlockDraft } from './TimeBlockDraftCard'

type Step = 'inputs' | 'review'

let draftIdCounter = 0
function nextDraftId() {
  draftIdCounter += 1
  return `tb-${draftIdCounter}`
}

export default function TimeBlockWizardModal({
  todayDateKey,
  onClose,
  onScheduled,
}: {
  todayDateKey: string
  onClose: () => void
  onScheduled: () => void
}) {
  const [step, setStep] = useState<Step>('inputs')

  const [wakeTime, setWakeTime] = useState(() => readLastWakeBedtime()?.wake ?? '')
  const [bedTime, setBedTime] = useState(() => readLastWakeBedtime()?.bedtime ?? '')

  const [timedEvents, setTimedEvents] = useState<CalendarEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [checkedEventIds, setCheckedEventIds] = useState<Set<string>>(new Set())
  const [keyEvents, setKeyEvents] = useState<KeyEventInput[]>([])

  const { todos } = useTodos(todayDateKey)
  const [educationTasks, setEducationTasks] = useState<EducationTask[]>([])

  const [drafts, setDrafts] = useState<TimeBlockDraft[]>([])
  const [unplaced, setUnplaced] = useState<TimeBlockCandidateItem[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingEvents(true)
    fetch('/api/calendar/today')
      .then(async (res) => {
        if (res.status === 409) {
          if (!cancelled) setNeedsReconnect(true)
          return []
        }
        if (!res.ok) {
          if (!cancelled) setEventsError("Couldn't load today's events.")
          return []
        }
        const json = await res.json()
        return (json.events ?? []) as CalendarEvent[]
      })
      .then((events) => {
        if (cancelled) return
        const timed = events.filter((event) => !event.allDay)
        setTimedEvents(timed)
        setCheckedEventIds(new Set(timed.map((event) => event.id)))
      })
      .catch(() => {
        if (!cancelled) setEventsError("Couldn't reach the server.")
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    supabase
      .from('education_tasks')
      .select('*')
      .eq('due_date', todayDateKey)
      .then(({ data }) => setEducationTasks((data ?? []) as EducationTask[]))
  }, [todayDateKey])

  const handleComputePlacements = () => {
    const window = resolveWindow(wakeTime, bedTime)

    const busyFromEvents: BusyInterval[] = timedEvents
      .filter((event) => checkedEventIds.has(event.id))
      .map((event) => {
        const startMinutes = dayOffsetFromToday(todayDateKey, event.start) * 1440 + parseHHmm(formatTime(event.start))
        const endMinutes = event.end
          ? dayOffsetFromToday(todayDateKey, event.end) * 1440 + parseHHmm(formatTime(event.end))
          : startMinutes + 60
        return { id: event.id, title: event.title, startMinutes, endMinutes: Math.max(endMinutes, startMinutes + 1) }
      })

    const busyFromKeyEvents: BusyInterval[] = keyEvents.map((keyEvent, index) => ({
      id: `key-${index}`,
      title: keyEvent.title,
      startMinutes: parseHHmm(keyEvent.startTime),
      endMinutes: parseHHmm(keyEvent.endTime),
    }))

    const todosDueOrOverdue = selectChecklistTodos(todos, todayDateKey)
    const candidates = buildCandidateItems(todosDueOrOverdue, educationTasks)

    const result = buildTimeBlockPlan({
      window,
      busyIntervals: [...busyFromEvents, ...busyFromKeyEvents],
      candidates,
      durationMinutes: DEFAULT_BLOCK_MINUTES,
    })

    setDrafts(
      result.placed.map((block) => ({
        ...block,
        clientId: nextDraftId(),
        status: 'pending' as const,
        error: null,
      }))
    )
    setUnplaced(result.unplaced)
    writeLastWakeBedtime(wakeTime, bedTime)
    setStep('review')
  }

  const handleConfirmDraft = async (clientId: string) => {
    const draft = drafts.find((d) => d.clientId === clientId)
    if (!draft) return

    setConfirmingId(clientId)
    setDrafts((prev) => prev.map((d) => (d.clientId === clientId ? { ...d, error: null } : d)))

    const { dayOffset, time } = splitDayOffset(draft.startMinutes)
    const dateKey = addDaysToKey(todayDateKey, dayOffset)
    const startAt = londonDateTimeToUTCISO(dateKey, time)

    try {
      const res = await fetch('/api/timeblock/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.candidate.title,
          start_at: startAt,
          durationMinutes: draft.endMinutes - draft.startMinutes,
          notes: draft.candidate.source === 'todo' ? 'Auto time-blocked (todo)' : 'Auto time-blocked (education task)',
        }),
      })
      const json = await res.json().catch(() => ({}) as { message?: string })
      if (!res.ok) {
        setDrafts((prev) =>
          prev.map((d) => (d.clientId === clientId ? { ...d, error: json.message ?? "Couldn't schedule this." } : d))
        )
        return
      }
      setDrafts((prev) => prev.map((d) => (d.clientId === clientId ? { ...d, status: 'accepted' } : d)))
      onScheduled()
    } catch {
      setDrafts((prev) =>
        prev.map((d) => (d.clientId === clientId ? { ...d, error: "Couldn't reach the server." } : d))
      )
    } finally {
      setConfirmingId(null)
    }
  }

  const handleDismissDraft = (clientId: string) => {
    setDrafts((prev) => prev.map((d) => (d.clientId === clientId ? { ...d, status: 'rejected' } : d)))
  }

  const handleDurationChange = (clientId: string, minutes: number) => {
    setDrafts((prev) =>
      prev.map((d) => (d.clientId === clientId ? { ...d, endMinutes: d.startMinutes + minutes } : d))
    )
  }

  const nextDisabled = loadingEvents || !wakeTime || !bedTime

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-habit-purple" />
          <h3 className="font-display text-sm font-semibold text-on-surface">Auto time-block today</h3>
        </div>

        {step === 'inputs' ? (
          <TimeBlockStepInputs
            wakeTime={wakeTime}
            bedTime={bedTime}
            onWakeTimeChange={setWakeTime}
            onBedTimeChange={setBedTime}
            timedEvents={timedEvents}
            loadingEvents={loadingEvents}
            eventsError={eventsError}
            needsReconnect={needsReconnect}
            onReconnect={() => connectGoogleCalendar('/calendar')}
            checkedEventIds={checkedEventIds}
            onToggleEvent={(id) =>
              setCheckedEventIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            keyEvents={keyEvents}
            onAddKeyEvent={(input) => setKeyEvents((prev) => [...prev, input])}
            onRemoveKeyEvent={(index) => setKeyEvents((prev) => prev.filter((_, i) => i !== index))}
            onNext={handleComputePlacements}
            nextDisabled={nextDisabled}
          />
        ) : (
          <TimeBlockStepReview
            drafts={drafts}
            unplaced={unplaced}
            confirmingId={confirmingId}
            onConfirm={handleConfirmDraft}
            onDismiss={handleDismissDraft}
            onDurationChange={handleDurationChange}
            onBack={() => setStep('inputs')}
            onDone={onClose}
          />
        )}
      </div>
    </Modal>
  )
}

// Days between todayDateKey and the Europe/London calendar date an event
// instant falls on — 0 for a normal same-day event, positive/negative for
// one that spans midnight (an overnight event starting yesterday, or an
// all-day-adjacent one bleeding into tomorrow). Lets an event's minutes
// stay consistent with resolveWindow/splitDayOffset's day-0/day-1 scheme
// even when the event itself doesn't start "today".
function dayOffsetFromToday(todayKey: string, iso: string): number {
  const eventKey = londonDateKey(iso)
  const today = new Date(`${todayKey}T00:00:00Z`)
  const event = new Date(`${eventKey}T00:00:00Z`)
  return Math.round((event.getTime() - today.getTime()) / 86_400_000)
}
