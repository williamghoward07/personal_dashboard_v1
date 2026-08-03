'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import ConfirmDialog from '../../ConfirmDialog'
import TaskCard from './TaskCard'
import TaskFormModal from './TaskFormModal'
import TaskDetailModal from './TaskDetailModal'

export default function TaskSection({
  moduleId,
  tasks,
  onChange,
}: {
  moduleId: string
  tasks: Task[]
  onChange: () => void
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-black/60 dark:text-white/60">
          Tasks
        </h3>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add task"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-black/40 dark:text-white/40">
          No tasks yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onOpen={() => setViewingTask(t)}
              onEdit={() => setEditingTask(t)}
              onDelete={() => setDeletingTask(t)}
            />
          ))}
        </div>
      )}

      <TaskFormModal
        isOpen={isAddOpen}
        heading="New task"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          await supabase.from('tasks').insert({ module_id: moduleId, ...values })
          setIsAddOpen(false)
          onChange()
        }}
      />

      <TaskFormModal
        isOpen={editingTask !== null}
        heading="Edit task"
        initialValues={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (values) => {
          if (!editingTask) return
          await supabase.from('tasks').update(values).eq('id', editingTask.id)
          setEditingTask(null)
          onChange()
        }}
      />

      {viewingTask && (
        <TaskDetailModal task={viewingTask} onClose={() => setViewingTask(null)} />
      )}

      <ConfirmDialog
        isOpen={deletingTask !== null}
        message={`Delete "${deletingTask?.title}"? This can't be undone.`}
        onCancel={() => setDeletingTask(null)}
        onConfirm={async () => {
          if (!deletingTask) return
          await supabase.from('tasks').delete().eq('id', deletingTask.id)
          setDeletingTask(null)
          onChange()
        }}
      />
    </div>
  )
}
