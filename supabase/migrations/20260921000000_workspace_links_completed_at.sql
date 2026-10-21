-- Workspace sources can be ticked off like a todo. A timestamp (not a boolean)
-- matches archived_at / completed_at elsewhere; null = still open.
-- Re-runnable. The existing own-row update policy already covers the column.

alter table public.workspace_links
  add column if not exists completed_at timestamptz;
