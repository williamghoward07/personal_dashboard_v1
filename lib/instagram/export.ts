// Pure CSV builder for a handle→person mapping export. Synchronous, no
// DOM/Supabase dependency, so it can be unit-tested directly — the caller
// resolves person names and wraps the string in a Blob download (see
// WorkspaceFooter's buildWorkspaceMarkdown for the same pattern).

export interface FollowExportRow {
  handle: string
  display_name: string | null
  followed_at: string
  category: string | null
  note: string | null
  person_full_name: string | null
}

const COLUMNS = ['handle', 'display_name', 'followed_at', 'category', 'note', 'linked_person'] as const

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function buildFollowsCsv(rows: FollowExportRow[]): string {
  const lines = [COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.handle,
        row.display_name ?? '',
        row.followed_at.slice(0, 10),
        row.category ?? '',
        row.note ?? '',
        row.person_full_name ?? '',
      ]
        .map(csvField)
        .join(',')
    )
  }
  return lines.join('\n')
}

export function followsExportFilename(ext: 'csv'): string {
  const date = new Date().toISOString().slice(0, 10)
  return `instagram-follows-${date}.${ext}`
}
