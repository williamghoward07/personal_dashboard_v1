import { supabase } from '@/lib/supabase'

// Deliberately duplicated (not imported) from
// app/components/widgets/app-launcher/shared.ts — Workspaces is meant to
// stay decoupled from every other module, and these are three trivial
// pure functions, not shared business logic. Both features point at the
// same `link-favicons` bucket and `/api/favicon` route (generic,
// provider-agnostic infra owned by neither feature).
const FAVICON_BUCKET = 'link-favicons'

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function faviconPublicUrl(path: string): string {
  return supabase.storage.from(FAVICON_BUCKET).getPublicUrl(path).data.publicUrl
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
