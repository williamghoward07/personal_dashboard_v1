-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- 20260804030000_transactions_bank_sync_columns.sql already documents that
-- amount must stop being NOT NULL once bank-synced rows populate
-- amount_minor_units instead of amount — every other statement in that
-- migration applied to the live DB (source_check constraint, the partial
-- unique index, the new columns), but this one `alter column ... drop not
-- null` never took, so every Starling sync insert (which never sets
-- `amount`, only `amount_minor_units`) has been failing with 23502 "null
-- value in column amount violates not-null constraint". Re-applying just
-- this statement; it's a no-op if it turns out to already be dropped.

alter table public.transactions
  alter column amount drop not null;
