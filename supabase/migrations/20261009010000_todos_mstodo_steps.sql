-- Every todo syncs to Microsoft To Do, and subtasks become To Do "steps"
-- (checklist items on the parent task).
--
-- Re-runnable: `if not exists` everywhere, functions are `create or replace`.
-- Apply after 20260917010000_todos_starred_and_mstodo.sql.
--
-- Design notes:
--   * App-created todos are now created in To Do as well
--     (lib/microsoft/todo-sync.ts), so a todo with subtasks will usually be
--     linked. The old guard ("a synced todo can't have subtasks") is
--     relaxed: a subtask of a linked todo is allowed, and is mirrored as a
--     step via mstodo_checklist_item_id. A linked *task* still can't be a
--     subtask, and nesting stays one level deep.
--   * Pruning a task deleted in To Do still cascades to its subtasks — they
--     were that task's steps, so they went with it.
--   * upsert_mstodo_todos accepts an optional `steps` array per row. When
--     present, the steps are upserted as the task's subtasks and any synced
--     subtask no longer in To Do is deleted. Subtasks not yet pushed
--     (mstodo_checklist_item_id is null) are never touched. When `steps` is
--     absent or null (steps weren't fetched), subtasks are left alone.

alter table public.todos add column if not exists mstodo_checklist_item_id text;

create unique index if not exists todos_user_mstodo_checklist_item_id_key
  on public.todos (user_id, mstodo_checklist_item_id)
  where mstodo_checklist_item_id is not null;

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

create or replace function public.upsert_mstodo_todos(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  parent_todo uuid;
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

  for item in select value from jsonb_array_elements(rows) loop
    if jsonb_typeof(item->'steps') <> 'array' then
      continue;
    end if;

    select t.id into parent_todo
    from public.todos t
    where t.user_id = auth.uid() and t.mstodo_task_id = item->>'mstodo_task_id';

    if parent_todo is null then
      continue;
    end if;

    insert into public.todos (user_id, title, completed_at, parent_id, mstodo_checklist_item_id)
    select
      auth.uid(),
      s->>'title',
      nullif(s->>'completed_at', '')::timestamptz,
      parent_todo,
      s->>'mstodo_checklist_item_id'
    from jsonb_array_elements(item->'steps') as s
    on conflict (user_id, mstodo_checklist_item_id) where mstodo_checklist_item_id is not null
    do update set
      title = excluded.title,
      completed_at = excluded.completed_at,
      parent_id = excluded.parent_id;

    delete from public.todos t
    where t.user_id = auth.uid()
      and t.parent_id = parent_todo
      and t.mstodo_checklist_item_id is not null
      and not exists (
        select 1 from jsonb_array_elements(item->'steps') as s
        where s->>'mstodo_checklist_item_id' = t.mstodo_checklist_item_id
      );
  end loop;
end;
$$;

revoke all on function public.upsert_mstodo_todos(jsonb) from public, anon;
grant execute on function public.upsert_mstodo_todos(jsonb) to authenticated;
