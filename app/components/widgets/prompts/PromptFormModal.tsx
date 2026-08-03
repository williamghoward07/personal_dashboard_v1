'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'

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
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          {heading}
        </h2>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Essay structuring"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Prompt
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={5}
            placeholder="Write the prompt text..."
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-black/80 px-3 py-1.5 text-sm text-white dark:bg-white/80 dark:text-black"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
