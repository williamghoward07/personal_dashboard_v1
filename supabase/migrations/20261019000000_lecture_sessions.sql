-- Lecture prep: module workspaces, readings per timetable session, and
-- per-session prep state (notes taken, "no readings").
--
-- Re-runnable: `if not exists`, guarded constraints, `drop policy if
-- exists`. Runs before or after 20261009020000.
--
-- Design notes:
--   * The timetable itself is never stored: it is read live from the
--     MyTimetable ICS feed (lib/timetable). A session is identified by its
--     ICS UID — Durham gives every occurrence its own UID.
--   * workspaces.module_code (e.g. GEOG1081) makes a workspace a module
--     workspace: it shows a Lectures section and lives on /lectures
--     instead of /workspaces. One workspace per code.
--   * workspace_links.is_reading marks a link as a reading (vs a source).
--     session_uid says which session it is for (null = not yet assigned).
--     Existing weekly readings (week set) are backfilled as readings.
--   * lecture_sessions holds what the user records about one session.
--     Rows are created on first interaction; title/starts_at are a snapshot
--     so a session that later vanishes from the feed is still explainable.

-- ------------------------------------------------------------ workspaces --

alter table public.workspaces add column if not exists module_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_module_code_check') then
    alter table public.workspaces
      add constraint workspaces_module_code_check
      check (module_code is null or module_code ~ '^[A-Z]{4}[0-9]{4}$');
  end if;
end $$;

create unique index if not exists workspaces_user_module_code_key
  on public.workspaces (user_id, module_code) where module_code is not null;

-- ------------------------------------------------------- workspace_links --

-- Also added (with their checks) by 20261009020000; repeated bare here so
-- this file can run first without failing on the backfill below.
alter table public.workspace_links add column if not exists completed_at timestamptz;
alter table public.workspace_links add column if not exists week smallint;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspace_links' and column_name = 'is_reading'
  ) then
    alter table public.workspace_links add column is_reading boolean not null default false;
    -- Once, with the column: weekly readings were readings all along.
    update public.workspace_links set is_reading = true where week is not null;
  end if;
end $$;

alter table public.workspace_links add column if not exists session_uid text;

create index if not exists workspace_links_session_uid_idx
  on public.workspace_links (workspace_id, session_uid) where session_uid is not null;

-- ------------------------------------------------------ lecture_sessions --

create table if not exists public.lecture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  uid text not null,
  module_code text,
  title text not null default '',
  starts_at timestamptz,
  notes_done_at timestamptz,
  no_readings boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint lecture_sessions_user_uid_key unique (user_id, uid)
);

alter table public.lecture_sessions enable row level security;

drop policy if exists "lecture_sessions_select_own" on public.lecture_sessions;
create policy "lecture_sessions_select_own" on public.lecture_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "lecture_sessions_insert_own" on public.lecture_sessions;
create policy "lecture_sessions_insert_own" on public.lecture_sessions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "lecture_sessions_update_own" on public.lecture_sessions;
create policy "lecture_sessions_update_own" on public.lecture_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "lecture_sessions_delete_own" on public.lecture_sessions;
create policy "lecture_sessions_delete_own" on public.lecture_sessions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.lecture_sessions from anon;
