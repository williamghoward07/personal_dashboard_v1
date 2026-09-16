import { Database, FileText, Newspaper, Link2, Lightbulb, Ban, Zap, Users, StickyNote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkspaceLinkKind, WorkspaceNoteKind } from '@/lib/types'

// Per-type presentation for sources and Thinking Log entries. Follows the
// DOT_CLASS pattern in app/components/calendar/calendarItems.ts — one map,
// literal Tailwind classes (Tailwind v4 has no config here and cannot see
// interpolated class names).

export interface KindMeta {
  label: string
  Icon: LucideIcon
  dotClass: string
  chipClass: string
}

export const SOURCE_KINDS: Record<WorkspaceLinkKind, KindMeta> = {
  paper: {
    label: 'Paper',
    Icon: Newspaper,
    dotClass: 'bg-research-pink',
    chipClass: 'bg-research-pink/10 text-research-pink border-research-pink/30',
  },
  data: {
    label: 'Data',
    Icon: Database,
    dotClass: 'bg-secondary-container',
    chipClass: 'bg-secondary-container/10 text-secondary-container border-secondary-container/30',
  },
  doc: {
    label: 'Doc',
    Icon: FileText,
    dotClass: 'bg-academic-orange',
    chipClass: 'bg-academic-orange/10 text-academic-orange border-academic-orange/30',
  },
  other: {
    label: 'Link',
    Icon: Link2,
    dotClass: 'bg-outline',
    chipClass: 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
  },
}

export const SOURCE_KIND_ORDER: WorkspaceLinkKind[] = ['paper', 'data', 'doc', 'other']

export const NOTE_KINDS: Record<WorkspaceNoteKind, KindMeta> = {
  realization: {
    label: 'Realization',
    Icon: Lightbulb,
    dotClass: 'bg-workspace-teal',
    chipClass: 'bg-workspace-teal/10 text-workspace-teal border-workspace-teal/30',
  },
  discarded: {
    label: 'Discarded Source',
    Icon: Ban,
    dotClass: 'bg-bible-crimson',
    chipClass: 'bg-bible-crimson/10 text-bible-crimson border-bible-crimson/30',
  },
  argument: {
    label: 'Argument Angle',
    Icon: Zap,
    dotClass: 'bg-people-amber',
    chipClass: 'bg-people-amber/10 text-people-amber border-people-amber/30',
  },
  meeting: {
    label: 'Meeting Note',
    Icon: Users,
    dotClass: 'bg-habit-purple',
    chipClass: 'bg-habit-purple/10 text-habit-purple border-habit-purple/30',
  },
  note: {
    label: 'Note',
    Icon: StickyNote,
    dotClass: 'bg-outline',
    chipClass: 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
  },
}

export const NOTE_KIND_ORDER: WorkspaceNoteKind[] = ['realization', 'discarded', 'argument', 'meeting', 'note']

const PAPER_HOSTS = [
  'doi.org',
  'nature.com',
  'science.org',
  'sciencedirect.com',
  'springer.com',
  'wiley.com',
  'tandfonline.com',
  'jstor.org',
  'arxiv.org',
  'pubmed.ncbi.nlm.nih.gov',
  'researchgate.net',
  'cambridge.org',
  'oup.com',
]

const DATA_EXTENSIONS = ['.csv', '.tsv', '.xlsx', '.xls', '.json', '.geojson', '.shp', '.zip']
const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.odt']

/**
 * Best-effort source type from a URL alone, used to pre-fill `kind` when a
 * link is added or dropped. Always correctable on the card afterwards —
 * a wrong guess is a cosmetic issue, never a data-loss one.
 */
export function detectLinkKind(url: string): WorkspaceLinkKind {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'other'
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  const path = parsed.pathname.toLowerCase()

  if (PAPER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return 'paper'
  if (DOC_EXTENSIONS.some((ext) => path.endsWith(ext))) return 'doc'
  if (DATA_EXTENSIONS.some((ext) => path.endsWith(ext))) return 'data'
  if (host.startsWith('data.') || host.includes('data.gov')) return 'data'
  if (host.includes('docs.google.com') || host.includes('sharepoint.com')) return 'doc'

  return 'other'
}
