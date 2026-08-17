-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Generalizes rugby_sessions into activity_sessions — a single table for
-- any manually-logged or Strava-CSV-imported activity, not just rugby.
-- activity_type is deliberately free text, not an enum: Strava's own
-- type list is long and open-ended, and manual entry should be able to
-- log anything without a schema change.
--
-- rugby_sessions is NOT dropped here — kept as a rollback safety net,
-- matching every other data-model migration so far (20260816010000,
-- 20260816020000).

create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  occurred_at timestamptz not null default now(),
  activity_type text not null,
  source text not null check (source in ('manual', 'strava_export')),
  duration_minutes integer,
  notes text,
  distance_km numeric,
  elevation_gain_m numeric,
  -- Strava's own Activity ID, for idempotent CSV re-import — always null
  -- for manual entries.
  external_id text,
  raw jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_sessions enable row level security;

create policy "Select own activity_sessions" on public.activity_sessions for select to authenticated using (auth.uid() = user_id);
create policy "Insert own activity_sessions" on public.activity_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own activity_sessions" on public.activity_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own activity_sessions" on public.activity_sessions for delete to authenticated using (auth.uid() = user_id);

revoke all on public.activity_sessions from anon;
grant select, insert, update, delete on public.activity_sessions to authenticated;

create index if not exists activity_sessions_user_id_idx on public.activity_sessions(user_id);

-- Same partial-uniqueness idempotency shape as transactions/accounts —
-- manual rows (external_id null) are unconstrained; a Strava CSV row
-- with the same Activity ID re-imported later updates in place rather
-- than duplicating.
create unique index if not exists activity_sessions_user_source_external_id_key
  on public.activity_sessions (user_id, source, external_id)
  where external_id is not null;

-- Backfill from rugby_sessions, preserving id (nothing currently
-- references it by FK, but this matches the id-preserving convention
-- used everywhere else in this app's data migrations).
insert into public.activity_sessions (
  id, user_id, occurred_at, activity_type, source, duration_minutes, notes, created_at
)
select
  r.id,
  r.user_id,
  r.date::timestamptz,
  'Rugby',
  'manual',
  r.duration_minutes,
  r.notes,
  r.created_at
from public.rugby_sessions r
where not exists (
  select 1 from public.activity_sessions a where a.id = r.id
);

-- PostgREST's .upsert() can't target a partial unique index directly (see
-- upsert_synced_transactions in 20260804030100 for the full explanation),
-- so a Strava CSV re-import needs the same ON-CONFLICT-server-side
-- wrapper. Unlike that one, this is called from the *session-scoped*
-- client (app/api/health/activity-import/route.ts uses the normal
-- authenticated client, not the admin one — a CSV upload is a direct
-- user action, not a background sync job), so user_id is taken from
-- auth.uid() inside the function rather than trusted from the payload —
-- safe specifically because a real user JWT is present on this call
-- path, unlike Starling sync's admin-client context.
create or replace function public.upsert_activity_sessions(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_sessions (
    user_id, occurred_at, activity_type, source, duration_minutes,
    distance_km, elevation_gain_m, external_id, raw
  )
  select
    auth.uid(),
    (r->>'occurred_at')::timestamptz,
    r->>'activity_type',
    'strava_export',
    (r->>'duration_minutes')::integer,
    (r->>'distance_km')::numeric,
    (r->>'elevation_gain_m')::numeric,
    r->>'external_id',
    r->'raw'
  from jsonb_array_elements(rows) as r
  on conflict (user_id, source, external_id) where external_id is not null
  do update set
    occurred_at = excluded.occurred_at,
    activity_type = excluded.activity_type,
    duration_minutes = excluded.duration_minutes,
    distance_km = excluded.distance_km,
    elevation_gain_m = excluded.elevation_gain_m,
    raw = excluded.raw;
end;
$$;

revoke all on function public.upsert_activity_sessions(jsonb) from public, anon;
grant execute on function public.upsert_activity_sessions(jsonb) to authenticated;
