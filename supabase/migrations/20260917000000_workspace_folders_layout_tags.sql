-- Workspaces phase 3: nested folders, per-workspace/per-folder colour,
-- per-workspace section layout (hide/collapse), and custom thinking-log
-- tags.
--
-- Re-runnable: tables/columns/indexes use `if not exists`, constraints are
-- guarded, and every policy/trigger is dropped before being re-created.
--
-- Design notes:
--   * workspace_folders.color is nullable on purpose (unlike
--     link_folders.color, which defaults to 'neutral'): a folder with no
--     colour lets its parent's colour show through. A workspace's colour
--     resolves workspace.color -> nearest ancestor folder with a colour ->
--     teal (lib/workspaces/folders.ts resolveAccent).
--   * Colour values are lib/theme.ts's Accent keys, teal included.
--   * Folders nest via parent_id. A BEFORE INSERT/UPDATE trigger rejects
--     cycles (a folder inside itself or one of its own descendants).
--   * Deleting a folder never deletes what's inside: a BEFORE DELETE
--     trigger moves its child folders and workspaces up to its own parent
--     first. The FKs' `on delete set null` is only a backstop.
--   * hidden_sections / collapsed_sections hold section keys from a fixed
--     set ('stats','sources','actions','log'). Hidden = not rendered (data
--     untouched); collapsed = rendered as a slim bar.
--   * workspace_notes.tags is set at INSERT time only — the table stays
--     append-only (no update/delete policy or grant added here). Tag
--     filtering and suggestions happen client-side, so no GIN index.

-- ------------------------------------------------------ workspace_folders --

create table if not exists public.workspace_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  parent_id uuid references public.workspace_folders(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_folders_color_check') then
    alter table public.workspace_folders
      add constraint workspace_folders_color_check
      check (color is null or color in ('mint','blue','orange','pink','purple','amber','crimson','teal','neutral'));
  end if;
end $$;

alter table public.workspace_folders enable row level security;

drop policy if exists "Select own workspace_folders" on public.workspace_folders;
drop policy if exists "Insert own workspace_folders" on public.workspace_folders;
drop policy if exists "Update own workspace_folders" on public.workspace_folders;
drop policy if exists "Delete own workspace_folders" on public.workspace_folders;
create policy "Select own workspace_folders" on public.workspace_folders for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspace_folders" on public.workspace_folders for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own workspace_folders" on public.workspace_folders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own workspace_folders" on public.workspace_folders for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workspace_folders from anon;
grant select, insert, update, delete on public.workspace_folders to authenticated;

create index if not exists workspace_folders_user_id_idx on public.workspace_folders(user_id);
create index if not exists workspace_folders_parent_id_idx on public.workspace_folders(parent_id);

-- Cycle guard. `union` (not `union all`) keeps the walk finite even if a
-- cycle somehow already existed.
create or replace function public.workspace_folders_guard_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A folder cannot be inside itself';
  end if;

  if exists (
    with recursive ancestors(id, parent_id) as (
      select f.id, f.parent_id from public.workspace_folders f where f.id = new.parent_id
      union
      select f.id, f.parent_id from public.workspace_folders f join ancestors a on f.id = a.parent_id
    )
    select 1 from ancestors where ancestors.id = new.id
  ) then
    raise exception 'A folder cannot be moved inside one of its own subfolders';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_folders_guard_parent on public.workspace_folders;
create trigger workspace_folders_guard_parent
  before insert or update of parent_id on public.workspace_folders
  for each row execute function public.workspace_folders_guard_parent();

create or replace function public.workspace_folders_reparent_on_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.workspace_folders set parent_id = old.parent_id where parent_id = old.id;
  update public.workspaces set folder_id = old.parent_id where folder_id = old.id;
  return old;
end;
$$;

-- ------------------------------------------------------------ workspaces --

alter table public.workspaces
  add column if not exists folder_id uuid references public.workspace_folders(id) on delete set null;
alter table public.workspaces add column if not exists color text;
alter table public.workspaces add column if not exists hidden_sections text[] not null default '{}';
alter table public.workspaces add column if not exists collapsed_sections text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspaces_color_check') then
    alter table public.workspaces
      add constraint workspaces_color_check
      check (color is null or color in ('mint','blue','orange','pink','purple','amber','crimson','teal','neutral'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_hidden_sections_check') then
    alter table public.workspaces
      add constraint workspaces_hidden_sections_check
      check (hidden_sections <@ array['stats','sources','actions','log']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspaces_collapsed_sections_check') then
    alter table public.workspaces
      add constraint workspaces_collapsed_sections_check
      check (collapsed_sections <@ array['stats','sources','actions','log']::text[]);
  end if;
end $$;

create index if not exists workspaces_folder_id_idx on public.workspaces(folder_id);

-- Created after workspaces.folder_id exists, since the function body
-- updates that column.
drop trigger if exists workspace_folders_reparent_on_delete on public.workspace_folders;
create trigger workspace_folders_reparent_on_delete
  before delete on public.workspace_folders
  for each row execute function public.workspace_folders_reparent_on_delete();

-- -------------------------------------------------------- workspace_notes --

alter table public.workspace_notes add column if not exists tags text[] not null default '{}';
