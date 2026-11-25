-- Blackboard work: item text + links, formative flag, handbook text, AI-derived
-- tables, a dashboard-side done flag, session overrides and two settings.
--
-- Re-runnable: `add column if not exists`, `if not exists`, guarded
-- constraints, `drop policy if exists`, `create or replace`.
-- Needs 20261109000000_blackboard_sync.sql and 20260920000000_user_settings.sql.
--
-- Ownership (a sync must never write a dashboard-owned column or table):
--   * Sync-owned, written by bb_sync_apply(): bb_content.body_text / links,
--     bb_assignments.is_formative. The *_hash columns are generated.
--   * Sync-owned, written by the document route (service-role client with an
--     explicit user_id), never by bb_sync_apply(): bb_documents, except
--     bb_documents.ai_hash.
--   * Dashboard-owned, never touched by a sync: bb_announcements.ai_hash,
--     bb_assignments.done_at, bb_documents.ai_hash, and the tables
--     bb_content_ai, bb_key_dates, bb_session_overrides.
--   * Nothing here writes to tasks or education_tasks.

-- ----------------------------------------------- sync-owned column adds --

-- Plain text of the item body / description (HTML stripped before it gets here).
alter table public.bb_content
  add column if not exists body_text text;

-- Links found in the body: [{ href, label, kind }], kind one of
-- talis | panopto | file | slides | other. Only the array shape is checked.
alter table public.bb_content
  add column if not exists links jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_content_links_array_check') then
    alter table public.bb_content
      add constraint bb_content_links_array_check check (jsonb_typeof(links) = 'array');
  end if;
end $$;

-- Changes whenever the title or body changes; AI work compares against it.
alter table public.bb_content
  add column if not exists body_hash text
    generated always as (md5(title || E'\n' || coalesce(body_text, ''))) stored;

alter table public.bb_announcements
  add column if not exists body_hash text
    generated always as (md5(title || E'\n' || coalesce(body_text, ''))) stored;

-- Null = unknown (Blackboard didn't say).
alter table public.bb_assignments
  add column if not exists is_formative boolean;

-- ------------------------------------------ dashboard-owned column adds --

-- The body_hash that AI extraction last processed.
alter table public.bb_announcements
  add column if not exists ai_hash text;

-- My own "mark as done" (for work with no Blackboard submission). Blackboard's
-- submitted / graded status still wins in the UI.
alter table public.bb_assignments
  add column if not exists done_at timestamptz;

-- user_settings.work_filter: the /lectures work list's last-used tab, type
-- chips and module filter. week_one_start: the Monday of university week 1.
-- Blackboard's "Week N" labels are Durham university weeks (week 12 is the
-- first teaching week), so week N starts at week_one_start + 7 * (N - 1) days.
-- Null = derive it from the timetable's first module session.
alter table public.user_settings
  add column if not exists work_filter jsonb not null default '{}'::jsonb;

alter table public.user_settings
  add column if not exists week_one_start date;

-- ---------------------------------------------------------- bb_documents --

-- Text extracted in the browser from a handbook / brief attached to a content
-- item. The file itself is never uploaded or stored.
create table if not exists public.bb_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.bb_content (id) on delete cascade,
  -- Blackboard's attachment id.
  bb_id text not null,
  file_name text not null,
  mime_type text,
  byte_size integer,
  version text,
  text text not null,
  page_count integer,
  text_hash text generated always as (md5(text)) stored,
  -- Dashboard-owned: the text_hash that AI extraction last processed.
  ai_hash text,
  fetched_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_documents_text_length_check') then
    alter table public.bb_documents
      add constraint bb_documents_text_length_check check (char_length(text) <= 500000);
  end if;
end $$;

create unique index if not exists bb_documents_user_bb_id_key on public.bb_documents (user_id, bb_id);
create index if not exists bb_documents_content_idx on public.bb_documents (content_id);

alter table public.bb_documents enable row level security;

drop policy if exists "bb_documents_select_own" on public.bb_documents;
create policy "bb_documents_select_own" on public.bb_documents
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_documents_insert_own" on public.bb_documents;
create policy "bb_documents_insert_own" on public.bb_documents
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid())
  );

drop policy if exists "bb_documents_update_own" on public.bb_documents;
create policy "bb_documents_update_own" on public.bb_documents
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid())
  );

drop policy if exists "bb_documents_delete_own" on public.bb_documents;
create policy "bb_documents_delete_own" on public.bb_documents
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_documents from anon;
grant select, insert, update, delete on public.bb_documents to authenticated;
-- The document route writes with the service-role client. It bypasses RLS but
-- still needs a plain grant (see 20260804020200_integrations_grant_service_role.sql).
grant select, insert, update, delete on public.bb_documents to service_role;

-- --------------------------------------------------------- bb_content_ai --

-- AI classification of a content item (one row per item).
create table if not exists public.bb_content_ai (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.bb_content (id) on delete cascade,
  role text not null default 'other',
  -- Durham university week number, same scale as bb_content.week_label.
  uni_week integer,
  session_type text,
  lecture_ordinal integer,
  explicit_date date,
  -- bb_content.body_hash at the last classification / extraction.
  classified_hash text,
  extracted_hash text,
  read_with_ai boolean not null default false,
  model text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_content_ai_role_check') then
    alter table public.bb_content_ai
      add constraint bb_content_ai_role_check
      check (role in ('slides', 'reading', 'recording', 'handout', 'task', 'admin', 'other'));
  end if;
end $$;

create unique index if not exists bb_content_ai_user_content_key on public.bb_content_ai (user_id, content_id);

alter table public.bb_content_ai enable row level security;

drop policy if exists "bb_content_ai_select_own" on public.bb_content_ai;
create policy "bb_content_ai_select_own" on public.bb_content_ai
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_content_ai_insert_own" on public.bb_content_ai;
create policy "bb_content_ai_insert_own" on public.bb_content_ai
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid())
  );

drop policy if exists "bb_content_ai_update_own" on public.bb_content_ai;
create policy "bb_content_ai_update_own" on public.bb_content_ai
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid())
  );

drop policy if exists "bb_content_ai_delete_own" on public.bb_content_ai;
create policy "bb_content_ai_delete_own" on public.bb_content_ai
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_content_ai from anon;
grant select, insert, update, delete on public.bb_content_ai to authenticated;

-- ---------------------------------------------------------- bb_key_dates --

-- Dated work the AI found in an announcement, an item body or a document.
-- Exactly one source. `quote` is the verbatim source text. A dismissed row is
-- kept so the same fingerprint never comes back.
create table if not exists public.bb_key_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.bb_courses (id) on delete cascade,
  announcement_id uuid references public.bb_announcements (id) on delete cascade,
  content_id uuid references public.bb_content (id) on delete cascade,
  document_id uuid references public.bb_documents (id) on delete cascade,
  title text not null,
  category text not null default 'other',
  due_on date not null,
  due_at timestamptz,
  -- What the AI originally said, kept when I edit due_on.
  ai_due_on date,
  for_session_type text,
  for_week integer,
  quote text not null,
  status text not null default 'suggested',
  -- Same deadline as an official Blackboard assignment.
  assignment_id uuid references public.bb_assignments (id) on delete set null,
  done_at timestamptz,
  fingerprint text not null,
  model text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_key_dates_one_source_check') then
    alter table public.bb_key_dates
      add constraint bb_key_dates_one_source_check
      check (num_nonnulls(announcement_id, content_id, document_id) = 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bb_key_dates_title_check') then
    alter table public.bb_key_dates
      add constraint bb_key_dates_title_check check (char_length(btrim(title)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bb_key_dates_category_check') then
    alter table public.bb_key_dates
      add constraint bb_key_dates_category_check
      check (category in ('summative', 'formative', 'test', 'tutorial', 'session_task', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bb_key_dates_status_check') then
    alter table public.bb_key_dates
      add constraint bb_key_dates_status_check check (status in ('suggested', 'confirmed', 'dismissed'));
  end if;
end $$;

create unique index if not exists bb_key_dates_user_fingerprint_key on public.bb_key_dates (user_id, fingerprint);
create index if not exists bb_key_dates_course_idx on public.bb_key_dates (course_id);
create index if not exists bb_key_dates_user_due_idx on public.bb_key_dates (user_id, due_on);

alter table public.bb_key_dates enable row level security;

drop policy if exists "bb_key_dates_select_own" on public.bb_key_dates;
create policy "bb_key_dates_select_own" on public.bb_key_dates
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_key_dates_insert_own" on public.bb_key_dates;
create policy "bb_key_dates_insert_own" on public.bb_key_dates
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
    and (announcement_id is null or exists (select 1 from public.bb_announcements n where n.id = announcement_id and n.user_id = auth.uid()))
    and (content_id is null or exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid()))
    and (document_id is null or exists (select 1 from public.bb_documents d where d.id = document_id and d.user_id = auth.uid()))
    and (assignment_id is null or exists (select 1 from public.bb_assignments a where a.id = assignment_id and a.user_id = auth.uid()))
  );

drop policy if exists "bb_key_dates_update_own" on public.bb_key_dates;
create policy "bb_key_dates_update_own" on public.bb_key_dates
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_courses c where c.id = course_id and c.user_id = auth.uid())
    and (announcement_id is null or exists (select 1 from public.bb_announcements n where n.id = announcement_id and n.user_id = auth.uid()))
    and (content_id is null or exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid()))
    and (document_id is null or exists (select 1 from public.bb_documents d where d.id = document_id and d.user_id = auth.uid()))
    and (assignment_id is null or exists (select 1 from public.bb_assignments a where a.id = assignment_id and a.user_id = auth.uid()))
  );

drop policy if exists "bb_key_dates_delete_own" on public.bb_key_dates;
create policy "bb_key_dates_delete_own" on public.bb_key_dates
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_key_dates from anon;
grant select, insert, update, delete on public.bb_key_dates to authenticated;

-- -------------------------------------------------- bb_session_overrides --

-- Fixes to the automatic lecture ↔ content matching: `hide` a matched item
-- from a session ("not relevant"), or `attach` one the matcher missed.
-- session_uid is the timetable ICS UID, or `gcal:<id>`.
create table if not exists public.bb_session_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_uid text not null,
  content_id uuid not null references public.bb_content (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bb_session_overrides_action_check') then
    alter table public.bb_session_overrides
      add constraint bb_session_overrides_action_check check (action in ('hide', 'attach'));
  end if;
end $$;

create unique index if not exists bb_session_overrides_user_session_content_key
  on public.bb_session_overrides (user_id, session_uid, content_id);

alter table public.bb_session_overrides enable row level security;

drop policy if exists "bb_session_overrides_select_own" on public.bb_session_overrides;
create policy "bb_session_overrides_select_own" on public.bb_session_overrides
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "bb_session_overrides_insert_own" on public.bb_session_overrides;
create policy "bb_session_overrides_insert_own" on public.bb_session_overrides
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid())
  );

drop policy if exists "bb_session_overrides_update_own" on public.bb_session_overrides;
create policy "bb_session_overrides_update_own" on public.bb_session_overrides
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.bb_content t where t.id = content_id and t.user_id = auth.uid())
  );

drop policy if exists "bb_session_overrides_delete_own" on public.bb_session_overrides;
create policy "bb_session_overrides_delete_own" on public.bb_session_overrides
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.bb_session_overrides from anon;
grant select, insert, update, delete on public.bb_session_overrides to authenticated;

-- --------------------------------------------------- service-role grants --

-- /api/blackboard/sync calls bb_sync_apply() (security invoker) with the
-- service-role client. That role bypasses RLS but still needs plain grants
-- (see 20260817030000_accounts_grant_service_role.sql). 20261109000000 only
-- granted `authenticated`, so a sync fails with 42501 "permission denied
-- for table bb_courses", and the route's failed-run row cannot be written
-- either, which leaves bb_sync_runs empty.
grant select, insert, update, delete on public.bb_courses to service_role;
grant select, insert, update, delete on public.bb_assignments to service_role;
grant select, insert, update, delete on public.bb_grades to service_role;
grant select, insert, update, delete on public.bb_announcements to service_role;
grant select, insert, update, delete on public.bb_content to service_role;
grant select, insert, update, delete on public.bb_sync_runs to service_role;
-- bb_sync_apply() matches a course to its module workspace by module_code.
grant select on public.workspaces to service_role;
-- The sync route reads read_with_ai to decide which documents to ask for.
grant select on public.bb_content_ai to service_role;

-- ---------------------------------------------------------- bb_sync_apply --

-- Same as 20261109000000_blackboard_sync.sql, plus: content reads and writes
-- body_text and links (a missing links → '[]'), assignments read and write
-- is_formative. A null body_text / is_formative in the payload overwrites the
-- stored value. Dashboard-owned columns (read_at, ai_hash, done_at, and
-- workspace_id once set) are not in any `do update set` list.
--
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
    (user_id, bb_id, course_id, title, due_at, bb_content_id, status, is_formative, url, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, c.id, r.title, r.due_at, r.bb_content_id, r.status, r.is_formative, r.url, v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'assignments', '[]'::jsonb))
    as r (bb_id text, course_bb_id text, title text, due_at timestamptz, bb_content_id text, status text, is_formative boolean, url text)
  join public.bb_courses c on c.user_id = v_uid and c.bb_id = r.course_bb_id
  on conflict (user_id, bb_id) do update set
    course_id = excluded.course_id,
    title = excluded.title,
    due_at = excluded.due_at,
    bb_content_id = excluded.bb_content_id,
    status = excluded.status,
    is_formative = excluded.is_formative,
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
    (user_id, bb_id, course_id, parent_bb_id, title, kind, available_from, path, week_label, url, body_text, links, first_seen_at, last_seen_at, removed_at)
  select v_uid, r.bb_id, c.id, r.parent_bb_id, r.title, r.kind, r.available_from,
    coalesce((select array_agg(p.value order by p.ordinality) from jsonb_array_elements_text(r.path) with ordinality as p (value, ordinality)), '{}'),
    r.week_label, r.url, r.body_text, coalesce(r.links, '[]'::jsonb), v_now, v_now, null
  from jsonb_to_recordset(coalesce(p_payload -> 'content', '[]'::jsonb))
    as r (bb_id text, course_bb_id text, parent_bb_id text, title text, kind text, available_from timestamptz, path jsonb, week_label int, url text, body_text text, links jsonb)
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
    body_text = excluded.body_text,
    links = excluded.links,
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
