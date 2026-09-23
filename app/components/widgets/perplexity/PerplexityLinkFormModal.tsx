'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-research-pink'
const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

export default function PerplexityLinkFormModal({
  isOpen,
  heading,
  existingFolders,
  initialUrl = '',
  initialTitle = '',
  initialFolder = '',
  onSave,
  onClose,
}: {
  isOpen: boolean
  heading: string
  existingFolders: string[]
  initialUrl?: string
  initialTitle?: string
  initialFolder?: string
  onSave: (url: string, title: string, folder: string) => void
  onClose: () => void
}) {
  const [url, setUrl] = useState(initialUrl)
  const [title, setTitle] = useState(initialTitle)
  const [folder, setFolder] = useState(initialFolder)

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl)
      setTitle(initialTitle)
      setFolder(initialFolder)
    }
  }, [isOpen, initialUrl, initialTitle, initialFolder])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!url.trim()) return
          onSave(url.trim(), title.trim(), folder.trim())
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="font-display text-sm font-semibold text-on-surface">{heading}</h2>
        <label className={labelClass}>
          Perplexity link
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.perplexity.ai/search/..."
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Title (optional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Glacial geomorphology overview"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Folder
          <input
            list="perplexity-folders"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g. Dissertation"
            className={inputClass}
          />
          <datalist id="perplexity-folders">
            {existingFolders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
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
            className="rounded-lg bg-research-pink px-3 py-1.5 text-sm font-medium text-surface-container-lowest hover:brightness-110"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
