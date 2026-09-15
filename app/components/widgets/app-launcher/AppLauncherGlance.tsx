'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, LayoutGrid, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { QuickLink } from '@/lib/types'
import { ACCENT_TEXT } from '@/lib/theme'
import WidgetCard from '../../WidgetCard'
import FaviconTile from './FaviconTile'
import { openQuickLink } from './shared'

const MAX_TILES = 7 // + one always-shown "More" tile

/**
 * Unlike the other home glance cards, this one can't just wrap the whole
 * card in a single Link (see HomeSectionCard/PeopleGlance) — each tile
 * needs its own click behaviour (open URL + update last_opened_at), so
 * the card is built directly on WidgetCard with the "view all" arrow
 * moved into the action slot instead.
 */
export default function AppLauncherGlance() {
  const [links, setLinks] = useState<QuickLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('quick_links')
      .select('*')
      .eq('is_pinned', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setLinks((data ?? []) as QuickLink[])
        setLoading(false)
      })
  }, [])

  return (
    <WidgetCard
      title="App Launcher"
      icon={<LayoutGrid className="h-4 w-4" />}
      accent="neutral"
      className="h-full"
      action={
        <Link
          href="/apps"
          aria-label="Open App Library"
          className={`transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.neutral}`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      {loading ? (
        <p>Loading...</p>
      ) : links.length === 0 ? (
        <p>No pinned apps yet — pin some from the App Library.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {links.slice(0, MAX_TILES).map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => openQuickLink(link)}
              title={link.title}
              className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-surface-container-high"
            >
              <FaviconTile title={link.title} url={link.url} faviconPath={link.favicon_path} size="sm" />
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
