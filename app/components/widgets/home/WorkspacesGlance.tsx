'use client'

import LoadingSkeleton from '@/app/components/LoadingSkeleton'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, FolderKanban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ACCENT_TEXT } from '@/lib/theme'
import { widgetDensity, type HomeWidgetDimensions } from '@/lib/home/widget-content'
import type { Workspace, WorkspaceFolder } from '@/lib/types'
import { resolveAccent } from '@/lib/workspaces/folders'
import { rankWorkspacesForGlance, type SessionStamp } from '@/lib/workspaces/glance'
import WidgetCard from '../../WidgetCard'
import { accentVars, relativeTime } from '../workspaces/shared'

// Enough recent session rows to cover the few workspaces shown here.
const SESSION_SAMPLE = 60

type GlanceWorkspace = Pick<
  Workspace,
  'id' | 'title' | 'subtitle' | 'color' | 'folder_id' | 'archived_at' | 'created_at' | 'hidden_sections'
>
type GlanceFolder = Pick<WorkspaceFolder, 'id' | 'name' | 'color' | 'parent_id'>

interface GlanceData {
  workspaces: GlanceWorkspace[]
  folders: GlanceFolder[]
  sessions: SessionStamp[]
  openTodoWorkspaceIds: (string | null)[]
}

/**
 * Built directly on WidgetCard (not HomeSectionCard) because each row is
 * its own link into that workspace — a whole-card link would nest anchors.
 */
export default function WorkspacesGlance(dimensions: HomeWidgetDimensions) {
  const [data, setData] = useState<GlanceData | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('workspaces')
        .select('id, title, subtitle, color, folder_id, archived_at, created_at, hidden_sections')
        .is('archived_at', null),
      supabase.from('workspace_folders').select('id, name, color, parent_id'),
      supabase
        .from('workspace_sessions')
        .select('workspace_id, started_at')
        .order('started_at', { ascending: false })
        .limit(SESSION_SAMPLE),
      supabase.from('todos').select('workspace_id').not('workspace_id', 'is', null).is('completed_at', null),
    ]).then(([w, f, s, t]) => {
      if (cancelled) return
      setData({
        workspaces: (w.data ?? []) as GlanceWorkspace[],
        folders: (f.data ?? []) as GlanceFolder[],
        sessions: (s.data ?? []) as SessionStamp[],
        openTodoWorkspaceIds: ((t.data ?? []) as { workspace_id: string | null }[]).map((r) => r.workspace_id),
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const density = widgetDensity(dimensions)
  const limit = [4, 6, 10][density]
  const rows = useMemo(
    () => (data ? rankWorkspacesForGlance(data.workspaces, data.sessions, data.openTodoWorkspaceIds, limit) : []),
    [data, limit]
  )
  const folderName = (id: string | null) => (id ? data?.folders.find((f) => f.id === id)?.name : undefined)

  return (
    <WidgetCard
      title="Workspaces"
      icon={<FolderKanban className="h-4 w-4" />}
      accent="teal"
      className="h-full min-w-0"
      action={
        <Link
          href="/workspaces"
          aria-label="View all workspaces"
          className={`grid min-h-11 min-w-11 place-items-center rounded [@media(pointer:fine)]:min-h-6 [@media(pointer:fine)]:min-w-6 transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.teal}`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      {!data ? (
        <LoadingSkeleton label="Loading..." />
      ) : rows.length === 0 ? (
        <p>
          No active workspaces.{' '}
          <Link href="/workspaces" className="inline-flex min-h-11 items-center underline hover:text-on-surface [@media(pointer:fine)]:min-h-6">
            Start one
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-x-5 gap-y-1 @min-[680px]/home-widget:grid-cols-2">
          {rows.map(({ workspace, lastOpenedAt, openActions }) => {
            const folder = folderName(workspace.folder_id)
            const showsActions = !(workspace.hidden_sections ?? []).includes('actions')
            const opened = relativeTime(lastOpenedAt)
            return (
              <li key={workspace.id} className="min-w-0" style={accentVars(resolveAccent(workspace, data.folders))}>
                <Link
                  href={`/workspaces/${workspace.id}`}
                  className="-mx-1.5 flex min-h-11 items-start gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-container-high"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ws-accent" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="wrap-anywhere text-on-surface">{workspace.title}</span>
                    <span className="wrap-anywhere text-xs text-on-surface-variant">
                      {[folder, opened ? `opened ${opened}` : 'not opened yet', showsActions && openActions > 0 ? `${openActions} open` : null].filter(Boolean).join(' · ')}
                    </span>
                    {density > 0 && workspace.subtitle && (
                      <span className="wrap-anywhere text-xs text-on-surface-variant">{workspace.subtitle}</span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
