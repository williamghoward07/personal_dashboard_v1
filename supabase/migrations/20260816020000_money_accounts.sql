-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Introduces a first-class `accounts` entity. Until now every transaction
-- (Starling-synced or manual) was flattened into one pool, distinguished
-- only by `source` + a free-text `account_label` — there was no way to
-- give "each bank account its own balance/net-change" because nothing
-- modeled an account as a row. Starling itself has always been
-- multi-account-capable (app/api/starling/sync/route.ts already loops
-- over getAccounts()) but that was never surfaced.
--
-- Trading212 is not part of this migration — it never persisted anything
-- to the database (pure live proxy, no transactions/integrations rows),
-- so its removal is a code-only change, done alongside this one.
--
-- accounts/transactions.account_id are additive only, matching the
-- rollback-safety-net posture of 20260816010000 — nothing existing is
-- dropped or renamed.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  source text not null check (source in ('starling', 'manual')),
  -- Starling's accountUid; always null for manual accounts.
  external_id text,
  currency text not null default 'GBP',
  -- Manual accounts only: the balance immediately before the earliest
  -- transaction ever recorded for this account in this app. A manual
  -- account's displayed balance is always this + the signed sum of its
  -- transactions — never a parsed "closing balance" off a statement page.
  -- Ignored for Starling accounts, whose balance is always fetched live.
  opening_balance_minor_units bigint not null default 0,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Select own accounts" on public.accounts for select to authenticated using (auth.uid() = user_id);
create policy "Insert own accounts" on public.accounts for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own accounts" on public.accounts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own accounts" on public.accounts for delete to authenticated using (auth.uid() = user_id);

revoke all on public.accounts from anon;
grant select, insert, update, delete on public.accounts to authenticated;

create index if not exists accounts_user_id_idx on public.accounts(user_id);

-- Starling accounts are upserted by (user_id, source, external_id) on
-- every sync (see app/api/starling/sync/route.ts); manual accounts never
-- carry an external_id, so they're excluded from the uniqueness check —
-- same partial-index shape as transactions_user_source_external_id_key
-- from 20260804030000.
create unique index if not exists accounts_user_source_external_id_key
  on public.accounts (user_id, source, external_id)
  where external_id is not null;

-- transactions gains a real link to the account it belongs to. Deleting a
-- manual account cascades to its transactions — manual entry/import is the
-- only way those rows exist, so removing the account really does mean
-- removing everything filed under it (the UI warns with the row count
-- before this fires, via ConfirmDialog).
alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

create index if not exists transactions_account_id_idx on public.transactions(account_id);

-- Backfill (idempotent — safe to re-run). Pre-existing manual transactions
-- predate the concept of an account entirely, so there's nothing more
-- specific to infer than "one account" — they all land in a single
-- renameable "General" account. Pre-existing Starling transactions get one
-- accounts row per distinct account_label already on them (best-effort:
-- account_label is free text, e.g. "Personal", not a captured Starling
-- accountUid — the sync route never stored the real id anywhere
-- retrievable until this migration's accompanying code change). Those
-- rows' external_id is left null; the next Starling sync reconciles each
-- in place by matching on name rather than inserting a duplicate account
-- for the same real-world one (see app/api/starling/sync/route.ts).

insert into public.accounts (user_id, name, source, currency)
select distinct t.user_id, 'General', 'manual', 'GBP'
from public.transactions t
where t.source = 'manual'
  and t.account_id is null
  and not exists (
    select 1 from public.accounts a
    where a.user_id = t.user_id and a.source = 'manual' and a.name = 'General'
  );

update public.transactions t
set account_id = a.id
from public.accounts a
where a.user_id = t.user_id
  and a.source = 'manual'
  and a.name = 'General'
  and t.source = 'manual'
  and t.account_id is null;

insert into public.accounts (user_id, name, source, currency)
select distinct t.user_id, t.account_label, 'starling', 'GBP'
from public.transactions t
where t.source = 'starling'
  and t.account_label is not null
  and not exists (
    select 1 from public.accounts a
    where a.user_id = t.user_id and a.source = 'starling' and a.name = t.account_label
  );

update public.transactions t
set account_id = a.id
from public.accounts a
where a.user_id = t.user_id
  and a.source = 'starling'
  and a.name = t.account_label
  and t.source = 'starling'
  and t.account_id is null;

-- Redefines upsert_synced_transactions (20260804030100) to also carry
-- account_id — the Starling sync route now resolves each feed item to its
-- account row before calling this RPC (see
-- app/api/starling/sync/route.ts). Same signature/security posture as the
-- original, just one extra column in both the insert list and the
-- conflict-update list.
create or replace function public.upsert_synced_transactions(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.transactions (
    user_id, source, external_id, account_label, account_id, merchant_name,
    amount_minor_units, type, category, description, date, raw
  )
  select
    (r->>'user_id')::uuid,
    r->>'source',
    r->>'external_id',
    r->>'account_label',
    (r->>'account_id')::uuid,
    r->>'merchant_name',
    (r->>'amount_minor_units')::bigint,
    r->>'type',
    r->>'category',
    r->>'description',
    (r->>'date')::date,
    r->'raw'
  from jsonb_array_elements(rows) as r
  on conflict (user_id, source, external_id) where external_id is not null
  do update set
    account_label = excluded.account_label,
    account_id = excluded.account_id,
    merchant_name = excluded.merchant_name,
    amount_minor_units = excluded.amount_minor_units,
    type = excluded.type,
    category = excluded.category,
    description = excluded.description,
    date = excluded.date,
    raw = excluded.raw;
end;
$$;

revoke all on function public.upsert_synced_transactions(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_synced_transactions(jsonb) to service_role;
