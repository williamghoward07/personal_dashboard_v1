-- Starred todos, and Microsoft To Do sync (replacing Apple Reminders via
-- CalDAV — iCloud only serves upgraded Reminders as placeholder lists, so
-- that sync never pulled anything; see CLAUDE.md "Todos & phone sync").
--
-- Re-runnable: `if not exists` everywhere, functions are `create or replace`.
--
-- Design notes:
--   * starred <-> To Do's importance ('high' = starred), both ways.
--   * mstodo_task_id / mstodo_list_id link a todo to the To Do task it was
--     pulled from. Null for app-created todos, which stay app-only.
--   * upsert_mstodo_todos mirrors upsert_caldav_todos (20260817020000):
--     security definer so the pull can upsert against the partial unique
--     index, with user_id pinned to auth.uid() — and list_id only accepted
--     when it's one of the caller's own todo_lists.
--   * A To Do-linked todo can't have app subtasks (same guard as CalDAV),
--     so pruning a task deleted in To Do never cascades into app-only rows.
--   * caldav_uid and upsert_caldav_todos are left in place (unused, no
--     rows ever set) — drop them in a later cleanup migration.

alter table public.todos add column if not exists starred boolean not null default false;
alter table public.todos add column if not exists mstodo_task_id text;
alter table public.todos add column if not exists mstodo_list_id text;

create unique index if not exists todos_user_mstodo_task_id_key
  on public.todos (user_id, mstodo_task_id)
  where mstodo_task_id is not null;

create or replace function public.upsert_mstodo_todos(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.todos (
    user_id, title, notes, due_date, due_time, completed_at, starred, list_id, mstodo_task_id, mstodo_list_id
  )
  select
    auth.uid(),
    r->>'title',
    nullif(r->>'notes', ''),
    nullif(r->>'due_date', '')::date,
    nullif(r->>'due_time', ''),
    nullif(r->>'completed_at', '')::timestamptz,
    coalesce((r->>'starred')::boolean, false),
    (
      select l.id from public.todo_lists l
      where l.id = nullif(r->>'list_id', '')::uuid and l.user_id = auth.uid()
    ),
    r->>'mstodo_task_id',
    r->>'mstodo_list_id'
  from jsonb_array_elements(rows) as r
  on conflict (user_id, mstodo_task_id) where mstodo_task_id is not null
  do update set
    title = excluded.title,
    notes = excluded.notes,
    due_date = excluded.due_date,
    due_time = excluded.due_time,
    completed_at = excluded.completed_at,
    starred = excluded.starred,
    list_id = excluded.list_id,
    mstodo_list_id = excluded.mstodo_list_id;
end;
$$;

revoke all on function public.upsert_mstodo_todos(jsonb) from public, anon;
grant execute on function public.upsert_mstodo_todos(jsonb) to authenticated;

-- Same guard as 20260818050000, extended to To Do-linked todos.
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

  if new.caldav_uid is not null or new.mstodo_task_id is not null then
    raise exception 'A synced todo cannot be a subtask';
  end if;

  if exists (
    select 1 from public.todos p
    where p.id = new.parent_id and (p.caldav_uid is not null or p.mstodo_task_id is not null)
  ) then
    raise exception 'A todo cannot be a subtask of a synced todo';
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
