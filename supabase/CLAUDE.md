# Supabase migrations

- Migrations are applied by hand (SQL editor or the Supabase connector), never CLI-pushed. Files and the live DB drift.
- Write every migration re-runnable: `if not exists`, `drop policy if exists`, guarded constraints, `create or replace`.
- New table: `user_id default auth.uid()`, four "own row" RLS policies, `revoke … from anon`.
- Child tables' RLS also checks that the parent row belongs to the user.
- RPCs: `security invoker` with `set search_path = ''`. Use `security definer` only when required, and then pin `auth.uid()` inside.
- The Education base tables (`years`, `modules`, `topics`, `tasks`, `time_logs`, …) exist only in the live DB. `20260803223028_remote_schema.sql` is empty.
- Not yet applied to the live DB:
  - `20260826000000_notes_documents.sql`
  - `20260921000000_workspace_links_completed_at.sql` (also covered by `20261009020000`)
  - `20261009000000_app_library_archive.sql`
  - `20261009010000_todos_mstodo_steps.sql`
  - `20261009020000_workspace_readings_and_time.sql`
