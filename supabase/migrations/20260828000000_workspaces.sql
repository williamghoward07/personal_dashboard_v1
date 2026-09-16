-- Workspaces: an ad hoc container grouping saved links, a scoped slice of
-- the existing todos table, and a running dated notes log around one
-- active task (e.g. an essay). Mechanics-first pass.
--
-- Design notes:
--   * workspace_links is fully separate from the App Launcher's
--     quick_links table (confirmed, not merged) but reuses the same
--     link-favicons Storage bucket and its existing public-read policy
--     from 20260827000000_link_folders_and_quick_links.sql — no new
--     bucket/policy here.
--   * archived_at is a nullable timestamptz (not a boolean), matching
--     completed_at/google_synced_at/last_opened_at elsewhere in this app.
--   * workspace_notes is append-only: NO update/delete RLS policy and the
--     grant itself omits update/delete, enforcing "no editing existing
--     entries" at the database layer, not just by omitting UI buttons.
--   * workspace_link_todos mirrors interaction_people's junction-table
--     shape exactly (20260810000000_people_crm.sql) — its own user_id and
--     full RLS, since RLS never inherits through foreign keys here.
--   * position is a plain dense/sequential integer, fully recomputed on
--     every reorder — matching sort_order everywhere else in this repo
--     (HabitBoard.tsx, use-todo-lists.ts), not fractional/gap-based.

-- ------------------------------------------------------------ workspaces --

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.workspaces enable row level security;

create policy "Select own workspaces" on public.workspaces for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspaces" on public.workspaces for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own workspaces" on public.workspaces for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own workspaces" on public.workspaces for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;

create index if not exists workspaces_user_id_idx on public.workspaces(user_id);
create index if not exists workspaces_archived_at_idx on public.workspaces(archived_at) where archived_at is not null;

-- -------------------------------------------------------- workspace_links --

create table if not exists public.workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- Always set at insert time from the client (domain-derived) — no
  -- separate title field in the add-by-URL/drop-a-URL flow, no rename UI
  -- in this pass, so not-null keeps every card render fallback-free.
  title text not null,
  url text not null,
  -- Object path within the shared link-favicons bucket (not a full URL).
  -- Null until the async favicon round trip resolves, or forever if it
  -- failed — either way the UI falls back to a plain text tile.
  favicon_path text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.workspace_links enable row level security;

create policy "Select own workspace_links" on public.workspace_links for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspace_links" on public.workspace_links for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own workspace_links" on public.workspace_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own workspace_links" on public.workspace_links for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workspace_links from anon;
grant select, insert, update, delete on public.workspace_links to authenticated;

create index if not exists workspace_links_user_id_idx on public.workspace_links(user_id);
create index if not exists workspace_links_workspace_id_idx on public.workspace_links(workspace_id);
create index if not exists workspace_links_position_idx on public.workspace_links(workspace_id, position);

-- -------------------------------------------------------- workspace_notes --

create table if not exists public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.workspace_notes enable row level security;

-- Append-only by design: select + insert only, no update/delete policy at
-- all, so RLS default-deny blocks those statements even for the owner.
create policy "Select own workspace_notes" on public.workspace_notes for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspace_notes" on public.workspace_notes for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.workspace_notes from anon;
grant select, insert on public.workspace_notes to authenticated;

create index if not exists workspace_notes_user_id_idx on public.workspace_notes(user_id);
create index if not exists workspace_notes_workspace_id_idx on public.workspace_notes(workspace_id);

-- --------------------------------------------------- workspace_link_todos --

create table if not exists public.workspace_link_todos (
  id uuid primary key default gen_random_uuid(),
  workspace_link_id uuid not null references public.workspace_links(id) on delete cascade,
  todo_id uuid not null references public.todos(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (workspace_link_id, todo_id)
);

alter table public.workspace_link_todos enable row level security;

create policy "Select own workspace_link_todos" on public.workspace_link_todos for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspace_link_todos" on public.workspace_link_todos for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own workspace_link_todos" on public.workspace_link_todos for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own workspace_link_todos" on public.workspace_link_todos for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workspace_link_todos from anon;
grant select, insert, update, delete on public.workspace_link_todos to authenticated;

create index if not exists workspace_link_todos_user_id_idx on public.workspace_link_todos(user_id);
create index if not exists workspace_link_todos_workspace_link_id_idx on public.workspace_link_todos(workspace_link_id);
create index if not exists workspace_link_todos_todo_id_idx on public.workspace_link_todos(todo_id);

-- ------------------------------------------------------ todos.workspace_id --

-- Independent of workspace_link_todos above and of the caldav_uid/
-- completed_at sync columns — a CalDAV-synced todo can be attached to a
-- workspace like any other; this column is never touched by the CalDAV
-- pull/push RPC or the check_todo_parent_guard trigger.
alter table public.todos add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists todos_workspace_id_idx on public.todos(workspace_id);
