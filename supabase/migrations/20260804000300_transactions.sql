-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
-- Adds real storage for manually-entered transactions on the Money page.
-- This is a deliberate manual-entry placeholder ahead of Monzo/Starling
-- read-only integration — the shape (date/amount/category/description/type)
-- is meant to match what a bank sync would populate, so swapping the
-- manual entry form for a sync job later shouldn't require a schema change.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  amount numeric not null,
  category text not null default 'Other',
  description text,
  type text not null check (type in ('income', 'outgoing')),
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "Allow all" on public.transactions for all using (true) with check (true);
grant select, insert, update, delete on public.transactions to anon, authenticated;
