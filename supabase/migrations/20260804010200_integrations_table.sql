-- Stores non-secret metadata about connected external integrations
-- (Monzo/Starling/Trading212 read-only OAuth, Strava, Calendar, etc).
-- Actual tokens are never stored here — they live in Supabase Vault,
-- referenced by vault_secret_name.
--
-- Created owner-scoped from the start (no permissive policy to unwind
-- later), matching the RLS treatment applied to every other table in
-- 20260804010100_owner_scoped_rls.sql.

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  connected_at timestamptz not null default now(),
  expires_at timestamptz,
  scopes text[] not null default '{}',
  vault_secret_name text,
  last_synced_at timestamptz,
  last_error text,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.integrations enable row level security;

create policy "Select own integrations" on public.integrations for select to authenticated using (auth.uid() = user_id);
create policy "Insert own integrations" on public.integrations for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own integrations" on public.integrations for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own integrations" on public.integrations for delete to authenticated using (auth.uid() = user_id);

revoke all on public.integrations from anon;
grant select, insert, update, delete on public.integrations to authenticated;

create index if not exists integrations_user_id_idx on public.integrations(user_id);
