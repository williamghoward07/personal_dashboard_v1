'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { formatTime } from '../calendarItems'
import type { CalendarEvent } from '../calendarItems'
import type { KeyEventInput } from '@/lib/timeblock/types'

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-habit-purple'

export default function TimeBlockStepInputs({
  wakeTime,
  bedTime,
  onWakeTimeChange,
  onBedTimeChange,
  timedEvents,
  loadingEvents,
  eventsError,
  needsReconnect,
  onReconnect,
  checkedEventIds,
  onToggleEvent,
  keyEvents,
  onAddKeyEvent,
  onRemoveKeyEvent,
  onNext,
  nextDisabled,
}: {
  wakeTime: string
  bedTime: string
  onWakeTimeChange: (value: string) => void
  onBedTimeChange: (value: string) => void
  timedEvents: CalendarEvent[]
  loadingEvents: boolean
  eventsError: string | null
  needsReconnect: boolean
  onReconnect: () => void
  checkedEventIds: Set<string>
  onToggleEvent: (id: string) => void
  keyEvents: KeyEventInput[]
  onAddKeyEvent: (input: KeyEventInput) => void
  onRemoveKeyEvent: (index: number) => void
  onNext: () => void
  nextDisabled: boolean
}) {
  const [keyDraft, setKeyDraft] = useState<KeyEventInput>({ title: '', startTime: '', endTime: '' })

  const handleAddKeyEvent = () => {
    if (!keyDraft.title.trim() || !keyDraft.startTime || !keyDraft.endTime) return
    if (keyDraft.endTime <= keyDraft.startTime) return
    onAddKeyEvent({ title: keyDraft.title.trim(), startTime: keyDraft.startTime, endTime: keyDraft.endTime })
    setKeyDraft({ title: '', startTime: '', endTime: '' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          Wake time
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => onWakeTimeChange(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-on-surface-variant">
          Bedtime
          <input
            type="time"
            value={bedTime}
            onChange={(e) => onBedTimeChange(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="label-caps text-on-surface-variant">
          Today&apos;s fixed events
        </p>
        {needsReconnect ? (
          <button
            type="button"
            onClick={onReconnect}
            className="flex w-fit items-center gap-1.5 rounded-md border border-outline-variant px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <RefreshCw className="h-3 w-3" />
            Reconnect Google Calendar
          </button>
        ) : loadingEvents ? (
          <p className="text-xs text-on-surface-variant">Loading today&apos;s events…</p>
        ) : eventsError ? (
          <p className="text-xs text-error">{eventsError}</p>
        ) : timedEvents.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No timed events on your calendar today.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {timedEvents.map((event) => (
              <li key={event.id}>
                <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-on-surface hover:bg-surface-container-high">
                  <input
                    type="checkbox"
                    checked={checkedEventIds.has(event.id)}
                    onChange={() => onToggleEvent(event.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="shrink-0 text-xs text-on-surface-variant">
                    {formatTime(event.start)}
                    {event.end ? `–${formatTime(event.end)}` : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-on-surface-variant/70">
          Unchecked events are treated as movable — auto-blocking may place something over them.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="label-caps text-on-surface-variant">
          Add a fixed event not on your calendar
        </p>
        {keyEvents.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {keyEvents.map((event, index) => (
              <li
                key={`${event.title}-${index}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-on-surface"
              >
                <span className="min-w-0 flex-1 truncate">{event.title}</span>
                <span className="shrink-0 text-xs text-on-surface-variant">
                  {event.startTime}–{event.endTime}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveKeyEvent(index)}
                  aria-label={`Remove ${event.title}`}
                  className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-outline-variant/60 p-2.5">
          <input
            value={keyDraft.title}
            onChange={(e) => setKeyDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Title"
            className={`${inputClass} min-w-[8rem] flex-1`}
          />
          <input
            type="time"
            value={keyDraft.startTime}
            onChange={(e) => setKeyDraft((d) => ({ ...d, startTime: e.target.value }))}
            className={inputClass}
          />
          <input
            type="time"
            value={keyDraft.endTime}
            onChange={(e) => setKeyDraft((d) => ({ ...d, endTime: e.target.value }))}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleAddKeyEvent}
            disabled={!keyDraft.title.trim() || !keyDraft.startTime || !keyDraft.endTime || keyDraft.endTime <= keyDraft.startTime}
            aria-label="Add key event"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-habit-purple text-surface disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="rounded-lg bg-habit-purple px-3 py-1.5 text-sm font-medium text-surface hover:brightness-110 disabled:opacity-40"
        >
          Next: review placements →
        </button>
      </div>
    </div>
  )
}
