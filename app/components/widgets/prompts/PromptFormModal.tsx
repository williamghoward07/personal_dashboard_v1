'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-research-pink'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export default function PromptFormModal({
  isOpen,
  heading,
  initialTitle = '',
  initialPrompt = '',
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  initialTitle?: string
  initialPrompt?: string
  onSave: (title: string, prompt: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [promptText, setPromptText] = useState(initialPrompt)

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle)
      setPromptText(initialPrompt)
    }
  }, [isOpen, initialTitle, initialPrompt])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim() || !promptText.trim()) return
          onSave(title.trim(), promptText.trim())
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>
        <label className={labelClass}>
          Title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Essay structuring"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Prompt
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={5}
            placeholder="Write the prompt text..."
            className={inputClass}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-research-pink px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
