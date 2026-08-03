'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Prompt } from '@/lib/types'

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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCopy()
        }
      }}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-black/10 bg-white/40 p-3 text-left hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-black/80 dark:text-white/80">
          {prompt.title}
        </h3>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            aria-label={`Edit ${prompt.title}`}
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
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
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="line-clamp-4 text-xs text-black/50 dark:text-white/50">
        {prompt.prompt}
      </p>
      <span
        className={`text-[10px] text-[#006300] transition-opacity dark:text-[#0ca30c] ${
          copied ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Copied to clipboard
      </span>
    </div>
  )
}
