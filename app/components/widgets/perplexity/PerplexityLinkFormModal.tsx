'use client'

import { useEffect, useState } from 'react'
import Modal from '../../Modal'

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
        <h2 className="text-sm font-semibold text-black/80 dark:text-white/80">
          {heading}
        </h2>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Perplexity link
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.perplexity.ai/search/..."
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Title (optional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Glacial geomorphology overview"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/60 dark:text-white/60">
          Folder
          <input
            list="perplexity-folders"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g. Dissertation"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/30"
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
