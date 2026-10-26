-- lecture_sessions and session_tasks were created without table grants for
-- `authenticated` (this project doesn't grant new tables by default), so
-- every read and write failed with "permission denied" before RLS ran.
-- RLS still limits each user to their own rows.
--
-- Re-runnable: grants are idempotent.

grant select, insert, update, delete on public.lecture_sessions to authenticated;
grant select, insert, update, delete on public.session_tasks to authenticated;
