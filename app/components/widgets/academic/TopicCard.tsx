'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { Topic } from '@/lib/types'

export default function TopicCard({
  topic,
  onEdit,
  onDelete,
}: {
  topic: Topic
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-black/80 dark:text-white/80">
          {topic.name}
        </h4>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${topic.name}`}
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${topic.name}`}
            className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-red-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {topic.confidence != null && (
        <span className="text-xs text-black/40 dark:text-white/40">
          Confidence: {topic.confidence}/5
        </span>
      )}
    </div>
  )
}
