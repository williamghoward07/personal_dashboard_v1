-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Starling Spaces (savings goals nested inside an account, e.g. "Don't
-- Spend" inside the Main Debit Account) are shown live on the Money page
-- as a read-only breakdown of that account's balance (see
-- app/api/starling/balance/route.ts) — this table is not what drives that
-- display. It exists purely to start accumulating history: every time
-- app/api/starling/sync/route.ts runs, it appends one snapshot row per
-- active Space, so a future trend view has data to work with instead of
-- only ever seeing "now". Append-only by design (plain insert, no
-- upsert/conflict target needed) — unlike accounts/transactions there's no
-- stable "current row" to update, just a growing series of point-in-time
-- balances.

create table if not exists public.starling_space_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- Starling's savingsGoalUid (or spaceUid for a spending/round-up space).
  space_external_id text not null,
  space_type text not null check (space_type in ('savings_goal', 'spending_space')),
  name text not null,
  currency text not null default 'GBP',
  minor_units bigint not null,
  -- Starling's Space state, e.g. 'ACTIVE' — kept for reference, not
  -- filtered on here; the sync route only ever writes ACTIVE spaces.
  state text,
  synced_at timestamptz not null default now()
);

alter table public.starling_space_snapshots enable row level security;

-- drop-then-create makes this migration safely re-runnable (CREATE POLICY
-- has no IF NOT EXISTS in Postgres, unlike CREATE TABLE/INDEX above).
drop policy if exists "Select own starling space snapshots" on public.starling_space_snapshots;
drop policy if exists "Insert own starling space snapshots" on public.starling_space_snapshots;
drop policy if exists "Update own starling space snapshots" on public.starling_space_snapshots;
drop policy if exists "Delete own starling space snapshots" on public.starling_space_snapshots;

create policy "Select own starling space snapshots" on public.starling_space_snapshots for select to authenticated using (auth.uid() = user_id);
create policy "Insert own starling space snapshots" on public.starling_space_snapshots for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own starling space snapshots" on public.starling_space_snapshots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own starling space snapshots" on public.starling_space_snapshots for delete to authenticated using (auth.uid() = user_id);

revoke all on public.starling_space_snapshots from anon;
grant select, insert, update, delete on public.starling_space_snapshots to authenticated;

-- app/api/starling/sync/route.ts writes via the service-role client
-- (lib/supabase/admin.ts) — service_role bypasses RLS but still needs an
-- explicit GRANT first (the exact gap 20260817030000 fixed for accounts).
grant select, insert, update, delete on public.starling_space_snapshots to service_role;

create index if not exists starling_space_snapshots_user_id_idx on public.starling_space_snapshots(user_id);

-- Fetching "the latest snapshot per space" is the only read pattern this
-- table needs to support well.
create index if not exists starling_space_snapshots_account_space_synced_idx
  on public.starling_space_snapshots (account_id, space_external_id, synced_at desc);
