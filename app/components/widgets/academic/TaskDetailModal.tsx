'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskResearchLink, Prompt, PerplexityLink } from '@/lib/types'
import Modal from '../../Modal'
import ResearchAttachModal from './ResearchAttachModal'
import TaskTimeTracking from './TaskTimeTracking'

type LinkedItem =
  | { linkId: string; kind: 'prompt'; id: string; label: string }
  | { linkId: string; kind: 'perplexity'; id: string; label: string }

export default function TaskDetailModal({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([])
  const [isAttachOpen, setIsAttachOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('task_research_links')
      .select('*')
      .eq('task_id', task.id)

    const rows = (data ?? []) as TaskResearchLink[]
    const promptIds = rows.filter((r) => r.prompt_id).map((r) => r.prompt_id as string)
    const linkIds = rows
      .filter((r) => r.perplexity_link_id)
      .map((r) => r.perplexity_link_id as string)

    const [promptsRes, linksRes] = await Promise.all([
      promptIds.length
        ? supabase.from('prompts').select('*').in('id', promptIds)
        : Promise.resolve({ data: [] as Prompt[] }),
      linkIds.length
        ? supabase.from('perplexity_links').select('*').in('id', linkIds)
        : Promise.resolve({ data: [] as PerplexityLink[] }),
    ])

    const prompts = (promptsRes.data ?? []) as Prompt[]
    const perpLinks = (linksRes.data ?? []) as PerplexityLink[]

    const items: LinkedItem[] = rows.flatMap((r): LinkedItem[] => {
      if (r.prompt_id) {
        const item = prompts.find((p) => p.id === r.prompt_id)
        if (!item) return []
        return [{ linkId: r.id, kind: 'prompt', id: item.id, label: item.title }]
      }
      if (r.perplexity_link_id) {
        const item = perpLinks.find((l) => l.id === r.perplexity_link_id)
        if (!item) return []
        return [
          {
            linkId: r.id,
            kind: 'perplexity',
            id: item.id,
            label: item.title || item.url,
          },
        ]
      }
      return []
    })

    setLinkedItems(items)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  const unlink = async (linkId: string) => {
    await supabase.from('task_research_links').delete().eq('id', linkId)
    refresh()
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-bold text-black/80 dark:text-white/80">
            {task.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-black/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/50 dark:text-white/50">
          {task.type && <span>Type: {task.type}</span>}
          {task.due_date && <span>Due: {task.due_date}</span>}
          {task.credit_weight != null && <span>Weight: {task.credit_weight}%</span>}
          {task.status && <span>Status: {task.status}</span>}
          {task.grade && <span>Grade: {task.grade}</span>}
        </div>

        {task.description && (
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-black/60 dark:text-white/60">
              Description
            </h3>
            <p className="text-sm text-black/70 dark:text-white/70">
              {task.description}
            </p>
          </div>
        )}

        {task.notes && (
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-black/60 dark:text-white/60">
              Notes
            </h3>
            <p className="text-sm text-black/70 dark:text-white/70">{task.notes}</p>
          </div>
        )}

        <TaskTimeTracking taskId={task.id} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-black/60 dark:text-white/60">
              Linked research
            </h3>
            <button
              type="button"
              onClick={() => setIsAttachOpen(true)}
              aria-label="Attach research"
              className="flex h-6 w-6 items-center justify-center rounded text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-black/40 dark:text-white/40">Loading...</p>
          ) : linkedItems.length === 0 ? (
            <p className="text-xs text-black/40 dark:text-white/40">
              Nothing attached yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {linkedItems.map((li) => (
                <li
                  key={li.linkId}
                  className="flex items-center justify-between gap-2 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10"
                >
                  <span className="truncate text-black/70 dark:text-white/70">
                    {li.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => unlink(li.linkId)}
                    aria-label="Unlink"
                    className="shrink-0 rounded p-0.5 text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isAttachOpen && (
        <ResearchAttachModal
          taskId={task.id}
          alreadyLinked={linkedItems.map((li) => li.id)}
          onClose={() => setIsAttachOpen(false)}
          onAttached={() => {
            setIsAttachOpen(false)
            refresh()
          }}
        />
      )}
    </Modal>
  )
}
