'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Module, Task } from '@/lib/types'
import ConfirmDialog from '../../ConfirmDialog'
import TaskCard from './TaskCard'
import TaskFormModal from './TaskFormModal'
import TaskDetailModal from './TaskDetailModal'

// Flat, due-date-sorted view across every module in the selected year.
// New tasks are still created from the per-module Modules view (that's
// where a task's module_id is unambiguous) — this view is for
// triage/editing across modules, not creation.
export default function TasksFlatView({ modules }: { modules: Module[] }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingTask, setViewingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  const moduleIds = modules.map((m) => m.id)
  const moduleIdsKey = moduleIds.join(',')
  const moduleName = (id: string) => modules.find((m) => m.id === id)?.name ?? ''

  const refresh = () => {
    if (moduleIds.length === 0) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('tasks')
      .select('*')
      .in('module_id', moduleIds)
      .order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setTasks(data ?? [])
        setLoading(false)
      })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIdsKey])

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading tasks...</p>
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        No tasks yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((t) => (
          <div key={t.id} className="flex flex-col gap-1">
            <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/70">
              {moduleName(t.module_id)}
            </span>
            <TaskCard
              task={t}
              onOpen={() => setViewingTask(t)}
              onEdit={() => setEditingTask(t)}
              onDelete={() => setDeletingTask(t)}
            />
          </div>
        ))}
      </div>

      <TaskFormModal
        isOpen={editingTask !== null}
        heading="Edit task"
        initialValues={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (values) => {
          if (!editingTask) return
          await supabase.from('tasks').update(values).eq('id', editingTask.id)
          setEditingTask(null)
          refresh()
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
          refresh()
        }}
      />
    </div>
  )
}
