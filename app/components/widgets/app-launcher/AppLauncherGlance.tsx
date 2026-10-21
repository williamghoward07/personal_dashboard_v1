'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, LayoutGrid, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { QuickLink } from '@/lib/types'
import { ACCENT_TEXT } from '@/lib/theme'
import type { HomeWidgetSpan } from '@/lib/settings/schema'
import { useSettings } from '@/lib/settings/use-settings'
import { useStoredIdSet } from '@/lib/utils/use-stored-id-set'
import {
  LAUNCHER_GRID_COLS_CLASS,
  reorderLauncherIds,
  resolveLauncherIds,
  seedLauncherIds,
  tilesForSpan,
  toggleLauncherLink,
} from '@/lib/app-launcher/launcher-selection'
import WidgetCard from '../../WidgetCard'
import FaviconTile from './FaviconTile'
import LauncherMenu from './LauncherMenu'
import { openQuickLink } from './shared'

// Per-browser "have we already tried the one-time is_pinned -> ordered
// array seed" marker (see the effect below). A Set of size 0 or 1 is a
// slightly odd use of useStoredIdSet, but it's the codebase's existing
// per-browser-remembered-state primitive and this is exactly that shape of
// state, so it's reused rather than hand-rolling localStorage access here.
const SEED_MARKER_KEY = 'app-launcher:seed-marker'
const SEED_MARKER_ID = 'done'

/**
 * Unlike the other home glance cards, this one can't just wrap the whole
 * card in a single Link (see HomeSectionCard/PeopleGlance) — each tile
 * needs its own click behaviour (open URL + update last_opened_at), so
 * the card is built directly on WidgetCard with the "view all" arrow
 * moved into the action slot instead.
 *
 * `launcher_link_ids` (lib/settings) is the single source of truth for
 * membership *and* order — `quick_links.is_pinned`/`sort_order` are only
 * read once, to seed it for an existing user (CLAUDE.md's App Library
 * section). `span` is P3's home-grid contract: a wider widget shows more
 * tiles (see lib/app-launcher/launcher-selection.ts's tilesForSpan).
 */
export default function AppLauncherGlance({ span = 1 }: { span?: HomeWidgetSpan }) {
  const [links, setLinks] = useState<QuickLink[]>([])
  const [loading, setLoading] = useState(true)
  const { settings, loading: settingsLoading, updateSettings } = useSettings()
  const [seedMarker, setSeedMarker] = useStoredIdSet(SEED_MARKER_KEY)

  useEffect(() => {
    supabase
      .from('quick_links')
      .select('*, folder:link_folders(archived_at)')
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        // A link in an archived folder is archived too.
        type Row = QuickLink & { folder: { archived_at: string | null } | null }
        setLinks(((data ?? []) as Row[]).filter((row) => !row.folder?.archived_at))
        setLoading(false)
      })
  }, [])

  // Seed launcher_link_ids once from the (retired) is_pinned rows, so an
  // existing user's launcher survives the move to the ordered array.
  // Guarded two ways: a per-browser marker so this only ever runs once
  // (an empty array after that is a deliberate "nothing selected", never
  // re-seeded), and only writes anything when there's a pinned link to
  // seed from in the first place.
  useEffect(() => {
    if (loading || settingsLoading || seedMarker.has(SEED_MARKER_ID)) return
    setSeedMarker(new Set([SEED_MARKER_ID]))
    if (settings.launcher_link_ids.length > 0) return
    const seed = seedLauncherIds(links)
    if (seed.length > 0) updateSettings({ launcher_link_ids: seed })
  }, [loading, settingsLoading, seedMarker, setSeedMarker, links, settings.launcher_link_ids, updateSettings])

  const availableIds = useMemo(() => new Set(links.map((link) => link.id)), [links])
  const selectedIds = useMemo(
    () => resolveLauncherIds(settings.launcher_link_ids, availableIds),
    [settings.launcher_link_ids, availableIds]
  )
  const linksById = useMemo(() => new Map(links.map((link) => [link.id, link])), [links])
  const selectedLinks = useMemo(
    () => selectedIds.map((id) => linksById.get(id)).filter((link): link is QuickLink => Boolean(link)),
    [selectedIds, linksById]
  )
  const visibleLinks = selectedLinks.slice(0, tilesForSpan(span))

  const handleToggle = (linkId: string) => {
    updateSettings({ launcher_link_ids: toggleLauncherLink(selectedIds, linkId) })
  }
  const handleReorder = (activeId: string, overId: string) => {
    updateSettings({ launcher_link_ids: reorderLauncherIds(selectedIds, activeId, overId) })
  }

  return (
    <WidgetCard
      title="App Launcher"
      icon={<LayoutGrid className="h-4 w-4" />}
      accent="neutral"
      className="h-full"
      action={
        <div className="flex items-center gap-2">
          <LauncherMenu links={links} selectedIds={selectedIds} onToggle={handleToggle} onReorder={handleReorder} />
          <Link
            href="/apps"
            aria-label="Open App Library"
            className={`transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.neutral}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      {loading ? (
        <p>Loading...</p>
      ) : visibleLinks.length === 0 ? (
        <p>No apps selected yet — choose some from the menu above, or the App Library.</p>
      ) : (
        <div className={`grid gap-2 ${LAUNCHER_GRID_COLS_CLASS[span]}`}>
          {visibleLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => openQuickLink(link)}
              title={link.title}
              className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-surface-container-high"
            >
              <FaviconTile
                title={link.title}
                url={link.url}
                faviconPath={link.favicon_path}
                faviconCustomUrl={link.favicon_custom_url}
                size="sm"
              />
              <span className="w-full truncate text-center text-[10px] text-on-surface-variant">
                {link.title}
              </span>
            </button>
          ))}
          <Link
            href="/apps"
            className="flex flex-col items-center gap-1 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant">
              <Plus className="h-4 w-4" />
            </span>
            <span className="text-[10px]">More</span>
          </Link>
        </div>
      )}
    </WidgetCard>
  )
}
