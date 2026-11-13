# Supabase migrations

- Migrations are applied by hand (SQL editor or the Supabase connector), never CLI-pushed. Files and the live DB drift.
- Write every migration re-runnable: `if not exists`, `drop policy if exists`, guarded constraints, `create or replace`.
- New table: `user_id default auth.uid()`, four "own row" RLS policies, `revoke … from anon`, and `grant select, insert, update, delete … to authenticated`. This project doesn't grant new tables by default, so without the grant every query fails with "permission denied" before RLS runs.
- Child tables' RLS also checks that the parent row belongs to the user.
- RPCs: `security invoker` with `set search_path = ''`. Use `security definer` only when required, and then pin `auth.uid()` inside.
- The Education base tables (`years`, `modules`, `topics`, `tasks`, `time_logs`, …) exist only in the live DB. `20260803223028_remote_schema.sql` is empty.
- Not yet applied to the live DB:
  - `20260826000000_notes_documents.sql`
  - `20261009010000_todos_mstodo_steps.sql`
- A route that uses the service-role client (`lib/supabase/admin.ts`) needs `grant … to service_role` on every table it or its RPC touches. That role bypasses RLS but not plain grants (this silently broke the Blackboard sync until `20261113000000_blackboard_work.sql`, applied 12 Nov 2026).
