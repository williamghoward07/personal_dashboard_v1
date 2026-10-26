-- A session's prep is "handed in" like a Teams assignment: green only once
-- the user presses Mark as done, however many readings are ticked.
--
-- Re-runnable: `if not exists`, and the backfill only fills nulls. Needs
-- 20261019000000 (lecture_sessions) first.
--
-- Design notes:
--   * prep_done_at replaces no_readings ("nothing to prepare"): handing in
--     with nothing added means the same thing. Rows already marked that
--     way are backfilled as handed in. Undo clears both columns, so a
--     re-run can't hand a session back in.
--   * Follow-up (notes_done_at, post-phase session_tasks) only shows once
--     prep is handed in, and never makes a session overdue.

alter table public.lecture_sessions add column if not exists prep_done_at timestamptz;

update public.lecture_sessions
  set prep_done_at = created_at
  where no_readings and prep_done_at is null;
