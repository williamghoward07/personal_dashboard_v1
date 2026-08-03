'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Topic } from '@/lib/types'
import ConfirmDialog from '../../ConfirmDialog'
import TopicCard from './TopicCard'
import TopicFormModal from './TopicFormModal'

export default function TopicSection({
  moduleId,
  topics,
  onChange,
}: {
  moduleId: string
  topics: Topic[]
  onChange: () => void
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60">
          Topics
        </h3>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add topic"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {topics.length === 0 ? (
        <p className="text-sm text-black/40 dark:text-white/40">
          No topics yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((t) => (
            <TopicCard
              key={t.id}
              topic={t}
              onEdit={() => setEditingTopic(t)}
              onDelete={() => setDeletingTopic(t)}
            />
          ))}
        </div>
      )}

      <TopicFormModal
        isOpen={isAddOpen}
        heading="New topic"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          await supabase.from('topics').insert({ module_id: moduleId, ...values })
          setIsAddOpen(false)
          onChange()
        }}
      />

      <TopicFormModal
        isOpen={editingTopic !== null}
        heading="Edit topic"
        initialValues={editingTopic}
        onClose={() => setEditingTopic(null)}
        onSave={async (values) => {
          if (!editingTopic) return
          await supabase.from('topics').update(values).eq('id', editingTopic.id)
          setEditingTopic(null)
          onChange()
        }}
      />

      <ConfirmDialog
        isOpen={deletingTopic !== null}
        message={`Delete "${deletingTopic?.name}"? This can't be undone.`}
        onCancel={() => setDeletingTopic(null)}
        onConfirm={async () => {
          if (!deletingTopic) return
          await supabase.from('topics').delete().eq('id', deletingTopic.id)
          setDeletingTopic(null)
          onChange()
        }}
      />
    </div>
  )
}
