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
    <div className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-on-surface">{topic.name}</h4>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${topic.name}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${topic.name}`}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {topic.confidence != null && (
        <span className="text-xs text-on-surface-variant">Confidence: {topic.confidence}/5</span>
      )}
    </div>
  )
}
