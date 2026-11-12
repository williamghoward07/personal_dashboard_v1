-- Blackboard sync, phase 2 (docs/specs/blackboard-sync-spec.md §5–6).
--
-- Re-runnable: `if not exists`, guarded constraints, `drop policy if
-- exists`, `create or replace`. Needs 20261019000000 (workspaces.module_code).
--
-- Design notes:
--   * Mirrors of my own Blackboard data, written only by /api/blackboard/sync
--     through bb_sync_apply(). Every table is keyed by (user_id, bb_id).
--     Nothing is hard-deleted: a row that vanishes from Blackboard gets
--     removed_at, and comes back (removed_at = null) if it reappears.
--   * bb_id values: courses, announcements and content use Blackboard's own
--     ids (`_123_1`). Assignments use todoItemKey() (`column:<id>`, else
--     `content:<id>`, else title + due date): To Do items have no id. Grades
--     use the gradebook column id.
--   * Assignments live here, not in tasks / education_tasks, so the known
--     Education split is left alone.
--   * bb_sync_runs is append-only by convention: one row per sync, ok or not.

-- ------------------------------------------------------------ bb_courses --

create table if not exists public.bb_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bb_id text not null,
  course_code text not null,
  module_code text,
  name text not null,
  term text,
  -- Auto-matched on workspaces.module_code when first seen (or while null);
  -- a value set by hand is never overwritten by a sync.
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- University week = Blackboard "Week N" + week_offset.
  week_offset integer not null default 0,
  url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

create unique index if not exists bb_courses_user_bb_id_key on public.bb_courses (user_id, bb_id);

alter table public.bb_courses enable row level security;

drop policy if exists "bb_courses_select_own" on public.bb_courses;
create policy "bb_courses_select_own" on public.bb_courses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_courses_insert_own" on public.bb_courses;
create policy "bb_courses_insert_own" on public.bb_courses
  for insert to authenticated with check (
    user_id = auth.uid()
    and (workspace_id is null or exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()))
  );

drop policy if exists "bb_courses_update_own" on public.bb_courses;
create policy "bb_courses_update_own" on public.bb_courses
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (workspace_id is null or exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()))
  );

drop policy if exists "bb_courses_delete_own" on public.bb_courses;
create policy "bb_courses_delete_own" on public.bb_courses
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_courses from anon;
grant select, insert, update, delete on public.bb_courses to authenticated;

-- -------------------------------------------------------- bb_assignments --

create table if not exists public.bb_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bb_id text not null,
  course_id uuid not null references public.bb_courses (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  bb_content_id text,
  status text not null default 'not_submitted',
  url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_assignments_status_check') then
    alter table public.bb_assignments
      add constraint bb_assignments_status_check check (status in ('not_submitted', 'submitted', 'graded'));
  end if;
end $$;

create unique index if not exists bb_assignments_user_bb_id_key on public.bb_assignments (user_id, bb_id);
create index if not exists bb_assignments_course_idx on public.bb_assignments (course_id);
create index if not exists bb_assignments_user_due_idx on public.bb_assignments (user_id, due_at);

alter table public.bb_assignments enable row level security;

drop policy if exists "bb_assignments_select_own" on public.bb_assignments;
create policy "bb_assignments_select_own" on public.bb_assignments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_assignments_insert_own" on public.bb_assignments;
create policy "bb_assignments_insert_own" on public.bb_assignments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "bb_assignments_update_own" on public.bb_assignments;
create policy "bb_assignments_update_own" on public.bb_assignments
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "bb_assignments_delete_own" on public.bb_assignments;
create policy "bb_assignments_delete_own" on public.bb_assignments
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_assignments from anon;
grant select, insert, update, delete on public.bb_assignments to authenticated;

-- ------------------------------------------------------------- bb_grades --

create table if not exists public.bb_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The gradebook column id.
  bb_id text not null,
  course_id uuid not null references public.bb_courses (id) on delete cascade,
  -- The assignment keyed `column:<bb_id>`, when there is one.
  assignment_id uuid references public.bb_assignments (id) on delete set null,
  score numeric,
  possible numeric,
  display_grade text,
  feedback text,
  released_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

create unique index if not exists bb_grades_user_bb_id_key on public.bb_grades (user_id, bb_id);
create index if not exists bb_grades_course_idx on public.bb_grades (course_id);

alter table public.bb_grades enable row level security;

drop policy if exists "bb_grades_select_own" on public.bb_grades;
create policy "bb_grades_select_own" on public.bb_grades
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_grades_insert_own" on public.bb_grades;
create policy "bb_grades_insert_own" on public.bb_grades
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
    and (assignment_id is null or exists (select 1 from public.bb_assignments a where a.id = assignment_id and a.user_id = auth.uid()))
  );

drop policy if exists "bb_grades_update_own" on public.bb_grades;
create policy "bb_grades_update_own" on public.bb_grades
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
    and (assignment_id is null or exists (select 1 from public.bb_assignments a where a.id = assignment_id and a.user_id = auth.uid()))
  );

drop policy if exists "bb_grades_delete_own" on public.bb_grades;
create policy "bb_grades_delete_own" on public.bb_grades
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_grades from anon;
grant select, insert, update, delete on public.bb_grades to authenticated;

-- ------------------------------------------------------ bb_announcements --

create table if not exists public.bb_announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bb_id text not null,
  course_id uuid not null references public.bb_courses (id) on delete cascade,
  title text not null,
  -- Plain text: the HTML body is stripped before it gets here.
  body_text text,
  posted_at timestamptz,
  url text,
  -- Dashboard-side only; never sent to Blackboard, never touched by a sync.
  read_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

create unique index if not exists bb_announcements_user_bb_id_key on public.bb_announcements (user_id, bb_id);
create index if not exists bb_announcements_course_idx on public.bb_announcements (course_id);

alter table public.bb_announcements enable row level security;

drop policy if exists "bb_announcements_select_own" on public.bb_announcements;
create policy "bb_announcements_select_own" on public.bb_announcements
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_announcements_insert_own" on public.bb_announcements;
create policy "bb_announcements_insert_own" on public.bb_announcements
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "bb_announcements_update_own" on public.bb_announcements;
create policy "bb_announcements_update_own" on public.bb_announcements
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "bb_announcements_delete_own" on public.bb_announcements;
create policy "bb_announcements_delete_own" on public.bb_announcements
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_announcements from anon;
grant select, insert, update, delete on public.bb_announcements to authenticated;

-- ------------------------------------------------------------ bb_content --

create table if not exists public.bb_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bb_id text not null,
  course_id uuid not null references public.bb_courses (id) on delete cascade,
  parent_bb_id text,
  title text not null,
  -- folder / document / link / file / assignment / lesson / discussion / tool / other
  kind text not null default 'other',
  available_from timestamptz,
  -- Titles of the folders above this item, top first.
  path text[] not null default '{}',
  -- "Week N" from the title, else from the nearest folder above it.
  week_label integer,
  url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

create unique index if not exists bb_content_user_bb_id_key on public.bb_content (user_id, bb_id);
create index if not exists bb_content_course_idx on public.bb_content (course_id);

alter table public.bb_content enable row level security;

drop policy if exists "bb_content_select_own" on public.bb_content;
create policy "bb_content_select_own" on public.bb_content
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_content_insert_own" on public.bb_content;
create policy "bb_content_insert_own" on public.bb_content
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "bb_content_update_own" on public.bb_content;
create policy "bb_content_update_own" on public.bb_content
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "bb_content_delete_own" on public.bb_content;
create policy "bb_content_delete_own" on public.bb_content
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_content from anon;
grant select, insert, update, delete on public.bb_content to authenticated;

-- ---------------------------------------------------------- bb_sync_runs --

create table if not exists public.bb_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  trigger text not null default 'manual',
  ok boolean not null,
  counts jsonb not null default '{}'::jsonb,
  error text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_sync_runs_trigger_check') then
    alter table public.bb_sync_runs
      add constraint bb_sync_runs_trigger_check check (trigger in ('manual', 'visit', 'daily'));
  end if;
end $$;

create index if not exists bb_sync_runs_user_finished_idx on public.bb_sync_runs (user_id, finished_at desc);

alter table public.bb_sync_runs enable row level security;

drop policy if exists "bb_sync_runs_select_own" on public.bb_sync_runs;
create policy "bb_sync_runs_select_own" on public.bb_sync_runs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_sync_runs_insert_own" on public.bb_sync_runs;
create policy "bb_sync_runs_insert_own" on public.bb_sync_runs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "bb_sync_runs_update_own" on public.bb_sync_runs;
create policy "bb_sync_runs_update_own" on public.bb_sync_runs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "bb_sync_runs_delete_own" on public.bb_sync_runs;
create policy "bb_sync_runs_delete_own" on public.bb_sync_runs
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_sync_runs from anon;
grant select, insert, update, delete on public.bb_sync_runs to authenticated;

-- ---------------------------------------------------------- bb_sync_apply --

-- Applies one normalised snapshot (lib/blackboard/normalise.ts →
-- BbSyncRows) in a single transaction: upsert every row, mark rows not seen
-- this time as removed (only within p_payload.scopes, i.e. courses whose
-- section was fetched without errors), link grades to assignments, and
-- append a bb_sync_runs row. Re-running the same payload changes nothing
-- but last_seen_at.
--
-- Security invoker. Browser callers are identified by auth.uid() (p_user_id
-- is ignored for them); the service-role client (the extension's bearer
-- token, lib/blackboard/auth.ts) passes p_user_id.
create or replace function public.bb_sync_apply(p_payload jsonb, p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(auth.uid(), p_user_id);
  v_now timestamptz := now();
  v_since timestamptz := (p_payload #>> '{scopes,assignment_window,since}')::timestamptz;
  v_until timestamptz := (p_payload #>> '{scopes,assignment_window,until}')::timestamptz;
  v_counts jsonb;
  v_due_changed jsonb;
  v_courses int;
  v_assignments int;
  v_grades int;
  v_announcements int;
  v_content int;
  v_rm_courses int := 0;
  v_rm_assignments int := 0;
  v_rm_grades int := 0;
  v_rm_announcements int := 0;
  v_rm_content int := 0;
  v_run_id uuid;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  -- One sync at a time per user.
  perform pg_advisory_xact_lock(hashtext('bb_sync:' || v_uid::text));

  -- Courses ---------------------------------------------------------------
  insert into public.bb_courses as c
    (user_id, bb_id, course_code, module_code, name, term, url, workspace_id, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, r.course_code, r.module_code, r.name, r.term, r.url,
    (select w.id from public.workspaces w where w.user_id = v_uid and w.module_code = r.module_code),
    v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'courses', '[]'::jsonb))
    as r (bb_id text, course_code text, module_code text, name text, term text, url text)
  on conflict (user_id, bb_id) do update set
    course_code = excluded.course_code,
    module_code = excluded.module_code,
    name = excluded.name,
    term = excluded.term,
    url = excluded.url,
    workspace_id = coalesce(c.workspace_id, excluded.workspace_id),
    last_seen_at = v_now,
    removed_at = null;
  get diagnostics v_courses = row_count;

  -- The memberships list is never partial (a lost session aborts the whole
  -- snapshot), so a course missing from it has gone. An empty list is
  -- treated as suspicious rather than "everything was dropped".
  if v_courses > 0 then
    update public.bb_courses c set removed_at = v_now
    where c.user_id = v_uid and c.removed_at is null and c.last_seen_at < v_now;
    get diagnostics v_rm_courses = row_count;
  end if;

  -- Assignments -----------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object('bb_id', a.bb_id, 'title', r.title, 'from', a.due_at, 'to', r.due_at)), '[]'::jsonb)
  into v_due_changed
  from jsonb_to_recordset(coalesce(p_payload -> 'assignments', '[]'::jsonb)) as r (bb_id text, title text, due_at timestamptz)
  join public.bb_assignments a on a.user_id = v_uid and a.bb_id = r.bb_id
  where a.due_at is distinct from r.due_at;

  insert into public.bb_assignments as a
    (user_id, bb_id, course_id, title, due_at, bb_content_id, status, url, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, c.id, r.title, r.due_at, r.bb_content_id, r.status, r.url, v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'assignments', '[]'::jsonb))
    as r (bb_id text, course_bb_id text, title text, due_at timestamptz, bb_content_id text, status text, url text)
  join public.bb_courses c on c.user_id = v_uid and c.bb_id = r.course_bb_id
  on conflict (user_id, bb_id) do update set
    course_id = excluded.course_id,
    title = excluded.title,
    due_at = excluded.due_at,
    bb_content_id = excluded.bb_content_id,
    status = excluded.status,
    url = excluded.url,
    last_seen_at = v_now,
    removed_at = null;
  get diagnostics v_assignments = row_count;

  -- An assignment is only "gone" where this snapshot would certainly have
  -- seen it: its course's gradebook was read cleanly, the To Do feed was
  -- read cleanly, and it's undated or due inside the To Do window. Older
  -- coursework that has simply scrolled out of the window is kept.
  if v_since is not null and v_until is not null then
    update public.bb_assignments a set removed_at = v_now
    from public.bb_courses c
    where a.user_id = v_uid and a.removed_at is null and a.last_seen_at < v_now
      and c.id = a.course_id
      and c.bb_id in (select jsonb_array_elements_text(coalesce(p_payload #> '{scopes,assignments}', '[]'::jsonb)))
      and (a.due_at is null or (a.due_at >= v_since and a.due_at < v_until));
    get diagnostics v_rm_assignments = row_count;
  end if;

  -- Grades ----------------------------------------------------------------
  insert into public.bb_grades as g
    (user_id, bb_id, course_id, score, possible, display_grade, feedback, released_at, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, c.id, r.score, r.possible, r.display_grade, r.feedback, r.released_at, v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'grades', '[]'::jsonb))
    as r (bb_id text, course_bb_id text, score numeric, possible numeric, display_grade text, feedback text, released_at timestamptz)
  join public.bb_courses c on c.user_id = v_uid and c.bb_id = r.course_bb_id
  on conflict (user_id, bb_id) do update set
    course_id = excluded.course_id,
    score = excluded.score,
    possible = excluded.possible,
    display_grade = excluded.display_grade,
    feedback = excluded.feedback,
    released_at = excluded.released_at,
    last_seen_at = v_now,
    removed_at = null;
  get diagnostics v_grades = row_count;

  update public.bb_grades g set removed_at = v_now
  from public.bb_courses c
  where g.user_id = v_uid and g.removed_at is null and g.last_seen_at < v_now
    and c.id = g.course_id
    and c.bb_id in (select jsonb_array_elements_text(coalesce(p_payload #> '{scopes,grades}', '[]'::jsonb)));
  get diagnostics v_rm_grades = row_count;

  update public.bb_grades g set assignment_id = a.id
  from public.bb_assignments a
  where g.user_id = v_uid and a.user_id = v_uid and a.bb_id = 'column:' || g.bb_id
    and g.assignment_id is distinct from a.id;

  -- Announcements ---------------------------------------------------------
  insert into public.bb_announcements as n
    (user_id, bb_id, course_id, title, body_text, posted_at, url, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, c.id, r.title, r.body_text, r.posted_at, r.url, v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'announcements', '[]'::jsonb))
    as r (bb_id text, course_bb_id text, title text, body_text text, posted_at timestamptz, url text)
  join public.bb_courses c on c.user_id = v_uid and c.bb_id = r.course_bb_id
  on conflict (user_id, bb_id) do update set
    course_id = excluded.course_id,
    title = excluded.title,
    body_text = excluded.body_text,
    posted_at = excluded.posted_at,
    url = excluded.url,
    last_seen_at = v_now,
    removed_at = null;
  get diagnostics v_announcements = row_count;

  update public.bb_announcements n set removed_at = v_now
  from public.bb_courses c
  where n.user_id = v_uid and n.removed_at is null and n.last_seen_at < v_now
    and c.id = n.course_id
    and c.bb_id in (select jsonb_array_elements_text(coalesce(p_payload #> '{scopes,announcements}', '[]'::jsonb)));
  get diagnostics v_rm_announcements = row_count;

  -- Content ---------------------------------------------------------------
  insert into public.bb_content as t
    (user_id, bb_id, course_id, parent_bb_id, title, kind, available_from, path, week_label, url, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, c.id, r.parent_bb_id, r.title, r.kind, r.available_from,
    coalesce((select array_agg(p.value order by p.ordinality) from jsonb_array_elements_text(r.path) with ordinality as p (value, ordinality)), '{}'),
    r.week_label, r.url, v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'content', '[]'::jsonb))
    as r (bb_id text, course_bb_id text, parent_bb_id text, title text, kind text, available_from timestamptz, path jsonb, week_label int, url text)
  join public.bb_courses c on c.user_id = v_uid and c.bb_id = r.course_bb_id
  on conflict (user_id, bb_id) do update set
    course_id = excluded.course_id,
    parent_bb_id = excluded.parent_bb_id,
    title = excluded.title,
    kind = excluded.kind,
    available_from = excluded.available_from,
    path = excluded.path,
    week_label = excluded.week_label,
    url = excluded.url,
    last_seen_at = v_now,
    removed_at = null;
  get diagnostics v_content = row_count;

  update public.bb_content t set removed_at = v_now
  from public.bb_courses c
  where t.user_id = v_uid and t.removed_at is null and t.last_seen_at < v_now
    and c.id = t.course_id
    and c.bb_id in (select jsonb_array_elements_text(coalesce(p_payload #> '{scopes,content}', '[]'::jsonb)));
  get diagnostics v_rm_content = row_count;

  -- Run log ---------------------------------------------------------------
  v_counts := jsonb_build_object(
    'courses', v_courses,
    'assignments', v_assignments,
    'grades', v_grades,
    'announcements', v_announcements,
    'content', v_content,
    'removed', jsonb_build_object(
      'courses', v_rm_courses,
      'assignments', v_rm_assignments,
      'grades', v_rm_grades,
      'announcements', v_rm_announcements,
      'content', v_rm_content
    ),
    'due_changed', v_due_changed,
    'skipped', coalesce(p_payload -> 'skipped', '{}'::jsonb),
    'errors', coalesce(p_payload -> 'errors', '[]'::jsonb)
  );

  insert into public.bb_sync_runs (user_id, started_at, finished_at, trigger, ok, counts)
  values (v_uid, coalesce((p_payload ->> 'started_at')::timestamptz, v_now), clock_timestamp(),
    coalesce(p_payload ->> 'trigger', 'manual'), true, v_counts)
  returning id into v_run_id;

  return v_counts || jsonb_build_object('run_id', v_run_id);
end $$;

revoke all on function public.bb_sync_apply(jsonb, uuid) from public, anon;
grant execute on function public.bb_sync_apply(jsonb, uuid) to authenticated, service_role;
