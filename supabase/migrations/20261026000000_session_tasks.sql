-- Session prep beyond readings: tasks before a session, concepts to
-- review after it, and prep tracking on ordinary Google Calendar events.
--
-- Re-runnable: `if not exists`, guarded constraints, `drop policy if
-- exists`. Needs 20261019000000 (lecture_sessions) first.
--
-- Design notes:
--   * session_tasks are keyed by session uid like lecture_sessions: an ICS
--     UID for a timetable session, `gcal:<event id>` for a Google event.
--     phase 'prep' = before the session (left half of the light), 'post' =
--     concepts to review after it (right half). A task with a url is a
--     reading. Module readings pasted as links still live in
--     workspace_links (session_uid) so the module workspace shows them.
--   * lecture_sessions.tracked turns prep on for a Google event (default
--     off: a normal event). Timetable sessions are always tracked and
--     ignore the column.

-- ------------------------------------------------------ lecture_sessions --

alter table public.lecture_sessions add column if not exists tracked boolean not null default false;

-- --------------------------------------------------------- session_tasks --

create table if not exists public.session_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_uid text not null,
  phase text not null default 'prep',
  title text not null,
  url text,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'session_tasks_phase_check') then
    alter table public.session_tasks
      add constraint session_tasks_phase_check check (phase in ('prep', 'post'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_tasks_title_check') then
    alter table public.session_tasks
      add constraint session_tasks_title_check check (length(btrim(title)) > 0);
  end if;
end $$;

create index if not exists session_tasks_user_session_idx
  on public.session_tasks (user_id, session_uid);

alter table public.session_tasks enable row level security;

drop policy if exists "session_tasks_select_own" on public.session_tasks;
create policy "session_tasks_select_own" on public.session_tasks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "session_tasks_insert_own" on public.session_tasks;
create policy "session_tasks_insert_own" on public.session_tasks
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "session_tasks_update_own" on public.session_tasks;
create policy "session_tasks_update_own" on public.session_tasks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "session_tasks_delete_own" on public.session_tasks;
create policy "session_tasks_delete_own" on public.session_tasks
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.session_tasks from anon;
