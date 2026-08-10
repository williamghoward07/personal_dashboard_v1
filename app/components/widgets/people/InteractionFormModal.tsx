'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Interaction, InteractionChannel, Person, Place } from '@/lib/types'
import {
  CHANNELS,
  cancelButtonClass,
  inputClass,
  labelClass,
  saveButtonClass,
  toLocalInputValue,
} from './shared'

export interface InteractionFormValues {
  occurred_at: string
  title: string | null
  summary: string
  channel: InteractionChannel
  place_id: string | null
  follow_up: string | null
  personIds: string[]
}

export default function InteractionFormModal({
  isOpen,
  heading,
  people,
  places,
  initialValues,
  initialPersonIds,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  people: Person[]
  places: Place[]
  initialValues?: Partial<Interaction> | null
  initialPersonIds?: string[]
  onSave: (values: InteractionFormValues) => void
  onClose: () => void
}) {
  const [occurredAt, setOccurredAt] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [channel, setChannel] = useState<InteractionChannel>('in_person')
  const [placeId, setPlaceId] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [personIds, setPersonIds] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setOccurredAt(
        toLocalInputValue(initialValues?.occurred_at ?? new Date().toISOString()),
      )
      setTitle(initialValues?.title ?? '')
      setSummary(initialValues?.summary ?? '')
      setChannel(initialValues?.channel ?? 'in_person')
      setPlaceId(initialValues?.place_id ?? '')
      setFollowUp(initialValues?.follow_up ?? '')
      setPersonIds(initialPersonIds ?? [])
    }
  }, [isOpen, initialValues, initialPersonIds])

  if (!isOpen) return null

  const togglePerson = (id: string) =>
    setPersonIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    )

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!occurredAt) return
          onSave({
            // datetime-local has no zone; treat it as local and store UTC.
            occurred_at: new Date(occurredAt).toISOString(),
            title: title || null,
            summary,
            channel,
            place_id: placeId || null,
            follow_up: followUp || null,
            personIds,
          })
        }}
        className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            When
            <input
              autoFocus
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as InteractionChannel)}
              className={inputClass}
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Coffee after the fieldwork lecture"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          What you talked about
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="The details worth remembering next time you speak"
            className={inputClass}
          />
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs text-on-surface-variant">Who was there</legend>
          {people.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              No people yet — add someone in the Directory first.
            </p>
          ) : (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pt-1">
              {people.map((person) => {
                const selected = personIds.includes(person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => togglePerson(person.id)}
                    aria-pressed={selected}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      selected
                        ? 'border-people-amber/50 bg-people-amber/10 text-people-amber'
                        : 'border-outline-variant text-on-surface-variant hover:border-outline'
                    }`}
                  >
                    {person.full_name}
                  </button>
                )
              })}
            </div>
          )}
        </fieldset>

        <label className={labelClass}>
          Where
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className={inputClass}
          >
            <option value="">No place</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Bring up next time
          <input
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="e.g. Ask how her dissertation proposal went"
            className={inputClass}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cancelButtonClass}>
            Cancel
          </button>
          <button type="submit" className={saveButtonClass}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
