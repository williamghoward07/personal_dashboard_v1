import Link from 'next/link'
import type { WorkspaceTag } from '@/lib/workspaces/use-workspace-lookup'
import { accentVars } from './shared'

// "Belongs to workspace X" tag for a todo, in that workspace's colour.
// Stops click propagation so it works inside clickable rows.
export default function WorkspaceChip({ workspace }: { workspace: WorkspaceTag }) {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      title={`In workspace: ${workspace.title}`}
      style={accentVars(workspace.accent)}
      className="flex max-w-40 shrink-0 items-center gap-1 rounded-full border border-ws-accent/30 bg-ws-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-ws-accent transition-colors hover:border-ws-accent/60"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ws-accent" aria-hidden />
      <span className="truncate">{workspace.title}</span>
    </Link>
  )
}
