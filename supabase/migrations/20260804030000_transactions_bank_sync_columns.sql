-- Extends manual-only transactions with the shape needed for read-only bank
-- syncs (Starling now, Monzo later). `amount` (numeric pounds) stays the
-- source of truth for manual rows and is left untouched; synced rows go
-- through amount_minor_units instead so bank sync never round-trips through
-- floating-point pounds. Readers should treat amount_minor_units as
-- authoritative when present and fall back to amount otherwise.
--
-- See 20260804030100 for the upsert path this enables — PostgREST's
-- .upsert() can't target a partial unique index directly.

alter table public.transactions
  add column if not exists source text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists account_label text,
  add column if not exists merchant_name text,
  add column if not exists amount_minor_units bigint,
  add column if not exists raw jsonb;

alter table public.transactions
  add constraint transactions_source_check check (source in ('manual', 'starling', 'monzo'));

-- Bank-synced rows carry amount_minor_units, not a manually-entered pounds
-- figure; amount remains required at the application layer for the manual
-- entry form, but the column itself can no longer be NOT NULL.
alter table public.transactions
  alter column amount drop not null;

-- Partial so manual rows (external_id null) stay unconstrained and bank
-- syncs (external_id = feed item / transaction id) are idempotent per
-- source. Multiple manual rows can share user_id/source freely.
create unique index if not exists transactions_user_source_external_id_key
  on public.transactions (user_id, source, external_id)
  where external_id is not null;
