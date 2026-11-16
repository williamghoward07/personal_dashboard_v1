'use client'

import type { MouseEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, LayoutGrid } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { LauncherLink } from '@/lib/app-launcher/launcher-groups'
import { groupLauncherLinks } from '@/lib/app-launcher/launcher-groups'
import { ACCENT_TEXT } from '@/lib/theme'
import type { HomeWidgetProps } from '@/lib/home/layout'
import { useStoredIdSet } from '@/lib/utils/use-stored-id-set'
import { LAUNCHER_TILE_GAP, LAUNCHER_TILE_HEIGHT, launcherColumns, launcherRowsForHeight } from '@/lib/app-launcher/launcher-layout'
import {
  reorderLauncherIds,
  resolveLauncherIds,
  seedLauncherIds,
  toggleLauncherLink,
} from '@/lib/app-launcher/launcher-selection'
import { useAppSettings } from '../../settings/SettingsProvider'
import WidgetCard from '../../WidgetCard'
import FaviconTile from './FaviconTile'
import LauncherMenu from './LauncherMenu'
import LauncherDialog, { LAUNCHER_LABEL_CLASS, LAUNCHER_TILE_CLASS, LauncherApp } from './LauncherDialog'

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
 * section).
 */
export default function AppLauncherGlance({ span = 1, height }: HomeWidgetProps) {
  const [links, setLinks] = useState<LauncherLink[]>([])
  const [loading, setLoading] = useState(true)
  const { settings, loading: settingsLoading, updateSettings } = useAppSettings()
  const [seedMarker, setSeedMarker] = useStoredIdSet(SEED_MARKER_KEY)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const [dialog, setDialog] = useState<{ title: string; links: LauncherLink[]; origin: DOMRect; trigger: HTMLElement } | null>(null)
  const [dimmed, setDimmed] = useState(false)
  const openDialog = (event: MouseEvent<HTMLElement>, title: string, dialogLinks: LauncherLink[]) => {
    const trigger = event.currentTarget
    setDialog({ title, links: dialogLinks, origin: trigger.getBoundingClientRect(), trigger })
    setDimmed(true)
  }

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const observer = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width))
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    supabase
      .from('quick_links')
      // Archived rows are filtered client-side (not with .is()), so the
      // launcher still loads before 20261009000000 adds archived_at.
      .select('*, folder:link_folders(*)')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        // A link in an archived folder is archived too.
        setLinks(((data ?? []) as LauncherLink[]).filter((row) => !row.archived_at && !row.folder?.archived_at))
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
    () => selectedIds.map((id) => linksById.get(id)).filter((link): link is LauncherLink => Boolean(link)),
    [selectedIds, linksById]
  )
  const columns = launcherColumns(span, gridWidth)
  const items = useMemo(() => groupLauncherLinks(selectedLinks), [selectedLinks])
  const capacity = columns * launcherRowsForHeight(height)
  const hasOverflow = items.length > capacity
  const visibleItems = items.slice(0, hasOverflow ? capacity - 1 : capacity)

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
      action={
        <div className="flex items-center gap-2">
          <LauncherMenu links={links} selectedIds={selectedIds} onToggle={handleToggle} onReorder={handleReorder} />
          <Link
            href="/apps"
            aria-label="Open App Library"
            className={`inline-flex items-center justify-center transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.neutral}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      <div ref={gridRef}>
        {loading || settingsLoading ? (
          <p>Loading...</p>
        ) : selectedLinks.length === 0 ? (
          <p>No apps selected yet — choose some from the menu above, or the App Library.</p>
        ) : (
          <div
            className="grid origin-center transition-[transform,opacity] duration-300 motion-reduce:transition-none"
            data-dimmed={dimmed || undefined}
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridAutoRows: LAUNCHER_TILE_HEIGHT,
              gap: LAUNCHER_TILE_GAP,
              ...(dimmed ? { transform: 'scale(0.97)', opacity: 0.6 } : null),
            }}
          >
            {visibleItems.map((item) => item.type === 'link' ? (
              <LauncherApp key={item.link.id} link={item.link} />
            ) : (
              <button key={item.folder.id} type="button" title={item.folder.name}
                aria-label={`Open ${item.folder.name} folder`}
                onClick={(event) => openDialog(event, item.folder.name, item.links)}
                className={LAUNCHER_TILE_CLASS}>
                <span aria-hidden="true" className="grid h-8 w-8 grid-cols-2 grid-rows-2 gap-0.5 rounded-lg bg-surface-container-high p-px">
                  {item.links.slice(0, 4).map((link) => <FaviconTile key={link.id} title={link.title} url={link.url} faviconPath={link.favicon_path} faviconCustomUrl={link.favicon_custom_url} size="xs" />)}
                </span>
                <span className={LAUNCHER_LABEL_CLASS}>{item.folder.name}</span>
              </button>
            ))}
            {hasOverflow && (
              <button type="button" onClick={(event) => openDialog(event, 'All selected apps', selectedLinks)}
                className="min-h-11 rounded-lg px-1 text-center text-xs font-medium text-on-surface-variant hover:bg-surface-container-high">
                Show all<br />{selectedLinks.length} apps
              </button>
            )}
          </div>
        )}
      </div>
      {dialog && <LauncherDialog title={dialog.title} links={dialog.links} origin={dialog.origin} returnFocusTo={dialog.trigger}
        onClosing={() => setDimmed(false)} onClose={() => { setDialog(null); setDimmed(false) }} />}
    </WidgetCard>
  )
}
