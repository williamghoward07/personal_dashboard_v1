-- Workspaces for study modules: weekly readings and a study-time log.
--
-- Re-runnable: `if not exists`, guarded constraints, `drop policy if
-- exists`. Includes 20260921000000's completed_at (if not exists), since
-- readings are ticked off with it — running this file alone is enough.
--
-- Design notes:
--   * A reading is a workspace_links row with a `week` (1..52). Sources
--     are the rows without one. Moving a link between the two is just
--     setting or clearing week, so citations, DOIs and linked todos come
--     along. A reading is done when completed_at is set.
--   * Two new layout section keys: 'readings' (a column) and 'time' (the
--     Study time stat card + log). Both start hidden on every existing
--     workspace and by default on new ones — non-study workspaces don't
--     change; a module workspace turns them on from the Layout menu.
--     The "hide them on existing workspaces" update runs only in the same
--     step that widens the constraint, so re-running never re-hides
--     sections someone has turned on.
--   * workspace_time_logs: one row per logged block (Opal session, typed
--     by hand), dated to a Europe/London calendar day. Rows are editable
--     and deletable — it's a log of record that the user corrects, not an
--     append-only journal. weekly_minutes_target is an optional goal for
--     the ring on the Study time card.

-- ------------------------------------------------------- workspace_links --

alter table public.workspace_links add column if not exists completed_at timestamptz;
alter table public.workspace_links add column if not exists week smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_links_week_check') then
    alter table public.workspace_links
      add constraint workspace_links_week_check check (week is null or week between 1 and 52);
  end if;
end $$;

create index if not exists workspace_links_week_idx
  on public.workspace_links (workspace_id, week) where week is not null;

-- ------------------------------------------------------------ workspaces --

alter table public.workspaces add column if not exists weekly_minutes_target int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_weekly_minutes_target_check') then
    alter table public.workspaces
      add constraint workspaces_weekly_minutes_target_check
      check (weekly_minutes_target is null or weekly_minutes_target between 1 and 10080);
  end if;

  -- Widen the section-key constraints once, hiding the new sections on
  -- every workspace that existed before.
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_hidden_sections_check'
      and pg_get_constraintdef(oid) like '%readings%'
  ) then
    alter table public.workspaces drop constraint if exists workspaces_hidden_sections_check;
    alter table public.workspaces drop constraint if exists workspaces_collapsed_sections_check;

    update public.workspaces
      set hidden_sections = hidden_sections || array['readings','time']::text[];

    alter table public.workspaces
      add constraint workspaces_hidden_sections_check
      check (hidden_sections <@ array['stats','sources','readings','actions','log','time']::text[]);
    alter table public.workspaces
      add constraint workspaces_collapsed_sections_check
      check (collapsed_sections <@ array['stats','sources','readings','actions','log','time']::text[]);
  end if;
end $$;

alter table public.workspaces alter column hidden_sections set default '{readings,time}';

-- --------------------------------------------------- workspace_time_logs --

create table if not exists public.workspace_time_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  day date not null,
  minutes int not null check (minutes between 1 and 1440),
  note text,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.workspace_time_logs enable row level security;

drop policy if exists "Select own workspace_time_logs" on public.workspace_time_logs;
drop policy if exists "Insert own workspace_time_logs" on public.workspace_time_logs;
drop policy if exists "Update own workspace_time_logs" on public.workspace_time_logs;
drop policy if exists "Delete own workspace_time_logs" on public.workspace_time_logs;

create policy "Select own workspace_time_logs" on public.workspace_time_logs
  for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspace_time_logs" on public.workspace_time_logs
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid())
  );
create policy "Update own workspace_time_logs" on public.workspace_time_logs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid())
  );
create policy "Delete own workspace_time_logs" on public.workspace_time_logs
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workspace_time_logs from anon;
grant select, insert, update, delete on public.workspace_time_logs to authenticated;

create index if not exists workspace_time_logs_user_id_idx on public.workspace_time_logs(user_id);
create index if not exists workspace_time_logs_workspace_day_idx on public.workspace_time_logs(workspace_id, day desc);
