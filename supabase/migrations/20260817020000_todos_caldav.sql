-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Adds Apple Reminders sync (via CalDAV) to todos. caldav_uid links a todo
-- to the VTODO it was pulled from — null for every todo created directly
-- in the app, which stay app-only and are never pushed to Reminders (see
-- app/api/caldav/reminders/pull/route.ts's header comment for the full
-- one-way-pull-plus-narrow-completion-push scope).

alter table public.todos add column if not exists caldav_uid text;

-- Same partial-unique-index idempotency shape as accounts/transactions/
-- activity_sessions — app-created todos (caldav_uid null) are
-- unconstrained; a pull upserts a CalDAV-linked todo in place instead of
-- duplicating it on every sync.
create unique index if not exists todos_user_caldav_uid_key
  on public.todos (user_id, caldav_uid)
  where caldav_uid is not null;

-- PostgREST's .upsert() can't target a partial unique index directly
-- (see upsert_synced_transactions in 20260804030100 for the full
-- explanation) — same RPC wrapper shape as upsert_activity_sessions
-- (20260817000000): called from the session-scoped client (the pull
-- route uses the normal authenticated client, not the admin one — this
-- is a direct user action, not a background job), so user_id is pinned
-- to auth.uid() inside the function rather than trusted from the
-- payload.
create or replace function public.upsert_caldav_todos(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.todos (user_id, title, notes, due_date, completed_at, caldav_uid)
  select
    auth.uid(),
    r->>'title',
    r->>'notes',
    nullif(r->>'due_date', '')::date,
    nullif(r->>'completed_at', '')::timestamptz,
    r->>'caldav_uid'
  from jsonb_array_elements(rows) as r
  on conflict (user_id, caldav_uid) where caldav_uid is not null
  do update set
    title = excluded.title,
    notes = excluded.notes,
    due_date = excluded.due_date,
    completed_at = excluded.completed_at;
end;
$$;

revoke all on function public.upsert_caldav_todos(jsonb) from public, anon;
grant execute on function public.upsert_caldav_todos(jsonb) to authenticated;
