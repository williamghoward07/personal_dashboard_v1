'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, Topic } from '@/lib/types'
import TaskSection from './TaskSection'
import TopicSection from './TopicSection'

export default function ModuleDetail({ moduleId }: { moduleId: string }) {
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
      <TaskSection moduleId={moduleId} tasks={tasks} onChange={refresh} />
      <TopicSection moduleId={moduleId} topics={topics} onChange={refresh} />
    </div>
  )
}
