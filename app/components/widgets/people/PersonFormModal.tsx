'use client'

import { useId, useState } from 'react'
import Modal from '../../Modal'
import captureStyles from '../braindump/BrainDump.module.css'
import type { Person } from '@/lib/types'
import { cancelButtonClass, inputClass, keepReviewFocus, labelClass, saveButtonClass } from './shared'

export interface PersonFormValues {
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  job_title: string | null
  linkedin_url: string | null
  how_we_met: string | null
  birthday: string | null
  notes: string | null
  tags: string[]
}

export default function PersonFormModal({
  isOpen,
  heading,
  initialValues,
  saving = false,
  saveError,
  captureReview = false,
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialValues?: Partial<Person> | null
  saving?: boolean
  saveError?: string | null
  captureReview?: boolean
  onSave: (values: PersonFormValues) => void
  onClose: () => void
}) {
  const headingId = useId()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [howWeMet, setHowWeMet] = useState('')
  const [birthday, setBirthday] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')

  const [previousOpen, setPreviousOpen] = useState(false)
  const [previousValues, setPreviousValues] = useState(initialValues)
  if (isOpen !== previousOpen || initialValues !== previousValues) {
    setPreviousOpen(isOpen)
    setPreviousValues(initialValues)
    if (isOpen) {
      setFullName(initialValues?.full_name ?? '')
      setEmail(initialValues?.email ?? '')
      setPhone(initialValues?.phone ?? '')
      setCompany(initialValues?.company ?? '')
      setJobTitle(initialValues?.job_title ?? '')
      setLinkedin(initialValues?.linkedin_url ?? '')
      setHowWeMet(initialValues?.how_we_met ?? '')
      setBirthday(initialValues?.birthday ?? '')
      setNotes(initialValues?.notes ?? '')
      setTags((initialValues?.tags ?? []).join(', '))
    }
  }

  if (!isOpen) return null

  const isGoogleContact = Boolean(initialValues?.google_resource_name)

  return (
    <Modal onClose={() => { if (!saving) onClose() }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (saving || !fullName.trim()) return
          onSave({
            full_name: fullName.trim(),
            email: email || null,
            phone: phone || null,
            company: company || null,
            job_title: jobTitle || null,
            linkedin_url: linkedin || null,
            how_we_met: howWeMet || null,
            birthday: birthday || null,
            notes: notes || null,
            tags: tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }}
        role={captureReview ? 'dialog' : undefined}
        aria-modal={captureReview || undefined}
        aria-labelledby={captureReview ? headingId : undefined}
        onKeyDown={captureReview ? keepReviewFocus : undefined}
        className={`flex max-h-[80dvh] flex-col gap-4 overflow-y-auto ${captureReview ? captureStyles.reviewForm : ''}`}
      >
        <h2 id={headingId} className="font-display text-sm font-semibold text-on-surface">{heading}</h2>

        <fieldset className="contents" disabled={saving}>
          {isGoogleContact && (
            <p className="rounded-md border border-people-amber/30 bg-people-amber/10 px-2 py-1.5 text-xs text-people-amber">
              Synced from Google Contacts. Saving here also updates the contact in Google
              (name, email, phone, company and LinkedIn) — birthday, notes and tags stay
              app-only.
            </p>
          )}

          <label className={labelClass}>
            Full name
            <input
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alice Whitfield"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Company
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Role
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            LinkedIn
            <input
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              How we met
              <input
                value={howWeMet}
                onChange={(e) => setHowWeMet(e.target.value)}
                placeholder="e.g. Geography fieldtrip"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Birthday
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            Tags (comma separated)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="university, rugby, family"
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Things worth remembering about them"
              className={inputClass}
            />
          </label>
        </fieldset>

        {saveError && <p role="alert" className="text-sm text-error">{saveError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cancelButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={saveButtonClass}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
