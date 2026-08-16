'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'
import type { Place, PlaceCategory } from '@/lib/types'
import { PLACE_CATEGORIES } from '@/lib/places'
import { cancelButtonClass, inputClass, labelClass, saveButtonClass } from './shared'

export interface PlaceFormValues {
  name: string
  address: string | null
  category: PlaceCategory
  latitude: number | null
  longitude: number | null
  notes: string | null
}

export default function PlaceFormModal({
  isOpen,
  heading,
  initialValues,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Place> | null
  onSave: (values: PlaceFormValues) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('other')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name ?? '')
      setAddress(initialValues?.address ?? '')
      setCategory(initialValues?.category ?? 'other')
      setLatitude(initialValues?.latitude ?? null)
      setLongitude(initialValues?.longitude ?? null)
      setNotes(initialValues?.notes ?? '')
    }
  }, [isOpen, initialValues])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          onSave({
            name: name.trim(),
            address: address || null,
            category,
            latitude,
            longitude,
            notes: notes || null,
          })
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <label className={labelClass}>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Boileroom"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PlaceCategory)}
              className={inputClass}
            >
              {PLACE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Latitude (optional)
            <input
              type="number"
              step="any"
              value={latitude ?? ''}
              onChange={(e) => setLatitude(e.target.value === '' ? null : Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Longitude (optional)
            <input
              type="number"
              step="any"
              value={longitude ?? ''}
              onChange={(e) => setLongitude(e.target.value === '' ? null : Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-on-surface-variant">
          Coordinates are optional — the map link falls back to the address, then the name.
        </p>

        <label className={labelClass}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
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
