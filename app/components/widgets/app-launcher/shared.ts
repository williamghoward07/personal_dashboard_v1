import { supabase } from '@/lib/supabase'
import type { Accent } from '@/lib/theme'
import type { QuickLink } from '@/lib/types'

export const FAVICON_BUCKET = 'link-favicons'

// Real link_folders.id values are uuids — this sentinel can never collide,
// so it's safe as the expand/collapse + reassignment-target key for the
// virtual "Unfiled" folder, which has no row of its own.
export const UNFILED_FOLDER_ID = 'unfiled'

export const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-outline'
export const labelClass = 'flex flex-col gap-1 text-xs text-on-surface-variant'

const FALLBACK_ACCENTS: Accent[] = ['mint', 'blue', 'orange', 'pink', 'purple', 'amber', 'crimson']

/**
 * Deterministic string -> one of the seven module accent colors. Picks a
 * fallback tile color for a link/folder with no cached favicon — indexes
 * into lib/theme.ts's existing ACCENT_CHIP/ACCENT_BAR set rather than
 * inventing a new hex value.
 */
export function hashAccent(input: string): Accent {
  let hash = 0
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0
  return FALLBACK_ACCENTS[Math.abs(hash) % FALLBACK_ACCENTS.length]
}

export function initialLetter(label: string): string {
  const trimmed = label.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Storage object path -> public URL. Pure string-building, no network call. */
export function faviconPublicUrl(path: string): string {
  return supabase.storage.from(FAVICON_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Opens a link in a new tab and fires a fire-and-forget last_opened_at update. */
export function openQuickLink(link: Pick<QuickLink, 'id' | 'url'>) {
  window.open(link.url, '_blank', 'noopener,noreferrer')
  supabase
    .from('quick_links')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('id', link.id)
    .then(({ error }) => {
      if (error) console.error('[app-launcher] last_opened_at update failed:', error.message)
    })
}

/** Calls app/api/favicon/route.ts; never throws — a failure just means "no cached favicon". */
export async function resolveFaviconPath(url: string): Promise<string | null> {
  try {
    const res = await fetch('/api/favicon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { path: string | null }
    return data.path
  } catch {
    return null
  }
}

/** Swaps sort_order between item[index] and its neighbor — the up/down reorder UI. */
export async function swapSortOrder(
  table: 'quick_links' | 'link_folders',
  items: { id: string; sort_order: number }[],
  index: number,
  direction: 'up' | 'down',
): Promise<{ error: { message: string } | null }> {
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= items.length) return { error: null }
  const a = items[index]
  const b = items[swapIndex]
  const [resA, resB] = await Promise.all([
    supabase.from(table).update({ sort_order: b.sort_order }).eq('id', a.id),
    supabase.from(table).update({ sort_order: a.sort_order }).eq('id', b.id),
  ])
  return { error: resA.error ?? resB.error ?? null }
}
