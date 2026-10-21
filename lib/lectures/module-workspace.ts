import type { WorkspaceSectionKey } from '@/lib/types'

// A module workspace starts with only what lecture prep needs: Lectures
// (always on for module workspaces), Sources and Next actions. Stats, the
// week-based readings, the log and study time stay a Layout toggle away.
export const MODULE_WORKSPACE_HIDDEN: WorkspaceSectionKey[] = ['stats', 'readings', 'log', 'time']

export const MODULE_CODE_RE = /^[A-Z]{4}\d{4}$/

/** "geog 1081" → "GEOG1081"; null when it isn't a module code. */
export function normalizeModuleCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, '').toUpperCase()
  return MODULE_CODE_RE.test(code) ? code : null
}

export function isModuleWorkspace(workspace: { module_code?: string | null }): boolean {
  return !!workspace.module_code
}
