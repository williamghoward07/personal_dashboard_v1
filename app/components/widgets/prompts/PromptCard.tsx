'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Prompt } from '@/lib/types'
import { onActivateKey } from '@/lib/utils/a11y'

export default function PromptCard({
  prompt,
  copied,
  onCopy,
  onEdit,
  onDelete,
}: {
  prompt: Prompt
  copied: boolean
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCopy}
      onKeyDown={onActivateKey(onCopy)}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container p-3 text-left transition-colors hover:border-research-pink/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-on-surface">{prompt.title}</h3>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            aria-label={`Edit ${prompt.title}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label={`Delete ${prompt.title}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="line-clamp-4 text-xs text-on-surface-variant">{prompt.prompt}</p>
      <span
        className={`text-[10px] text-primary-container transition-opacity ${
          copied ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Copied to clipboard
      </span>
    </div>
  )
}
