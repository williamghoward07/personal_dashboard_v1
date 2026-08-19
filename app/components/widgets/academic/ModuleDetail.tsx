'use client'

import { useEffect, useState } from 'react'
import { NotebookText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Module, Task, Topic } from '@/lib/types'
import TaskSection from './TaskSection'
import TopicSection from './TopicSection'
import OneNoteSectionBrowser from './OneNoteSectionBrowser'

export default function ModuleDetail({
  moduleId,
  module,
}: {
  moduleId: string
  module?: Module | null
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: true }),
      supabase
        .from('topics')
        .select('*')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: true }),
    ]).then(([taskRes, topicRes]) => {
      setTasks(taskRes.data ?? [])
      setTopics(topicRes.data ?? [])
      setLoading(false)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId])

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading module...</p>
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      {module?.onenote_section_id ? (
        <OneNoteSectionBrowser
          sectionId={module.onenote_section_id}
          sectionName={module.onenote_section_name ?? 'OneNote section'}
        />
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <NotebookText className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
          <span className="text-on-surface-variant/60">
            Notes — not connected yet (edit the module to choose a OneNote section)
          </span>
        </div>
      )}

      <TaskSection moduleId={moduleId} tasks={tasks} onChange={refresh} />
      <TopicSection moduleId={moduleId} topics={topics} onChange={refresh} />
    </div>
  )
}
