-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Todo Widget overhaul, Phase A (schema): adds one-per-todo lists
-- (todo_lists + todos.list_id, mirroring education_tasks.module_id ->
-- modules) and app-only single-level sub-todos (todos.parent_id,
-- self-referencing). See todo-widget-functional-frost.md for the full
-- three-phase plan.

create table if not exists public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.todo_lists enable row level security;
create policy "Select own todo_lists" on public.todo_lists for select to authenticated using (auth.uid() = user_id);
create policy "Insert own todo_lists" on public.todo_lists for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own todo_lists" on public.todo_lists for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own todo_lists" on public.todo_lists for delete to authenticated using (auth.uid() = user_id);
revoke all on public.todo_lists from anon;
grant select, insert, update, delete on public.todo_lists to authenticated;

create index if not exists todo_lists_user_id_idx on public.todo_lists(user_id);

-- Deleting a list un-categorizes its todos rather than deleting them —
-- same on delete set null semantics as education_tasks.module_id.
alter table public.todos add column if not exists list_id uuid references public.todo_lists(id) on delete set null;

-- Deleting a parent removes its subtasks — a subtask has no meaning
-- without its parent.
alter table public.todos add column if not exists parent_id uuid references public.todos(id) on delete cascade;

create index if not exists todos_list_id_idx on public.todos(list_id);
create index if not exists todos_parent_id_idx on public.todos(parent_id);

-- A plain CHECK constraint can't reference the parent row, so the
-- CalDAV/nesting/ownership guards below need a BEFORE INSERT OR UPDATE
-- trigger instead. This is what keeps the CalDAV pull route's existing
-- stale-todo pruning (app/api/caldav/reminders/pull/route.ts:53-66) safe:
-- a CalDAV-linked todo is guaranteed to never have subtasks, so that
-- pruning can never cascade-delete an app-only subtask.
create or replace function public.check_todo_parent_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.caldav_uid is not null then
    raise exception 'A CalDAV-linked todo cannot be a subtask';
  end if;

  if exists (select 1 from public.todos p where p.id = new.parent_id and p.caldav_uid is not null) then
    raise exception 'A todo cannot be a subtask of a CalDAV-linked todo';
  end if;

  if exists (select 1 from public.todos p where p.id = new.parent_id and p.parent_id is not null) then
    raise exception 'Subtasks cannot be nested more than one level deep';
  end if;

  if exists (select 1 from public.todos p where p.id = new.parent_id and p.user_id <> new.user_id) then
    raise exception 'A todo cannot be a subtask of another user''s todo';
  end if;

  return new;
end;
$$;

drop trigger if exists todos_parent_guard on public.todos;
create trigger todos_parent_guard
  before insert or update on public.todos
  for each row
  execute function public.check_todo_parent_guard();
