-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Lets the user hide a Starling Space (pot) they don't use from the Money
-- page's pots breakdown. A hidden pot is represented by row *presence*,
-- not a boolean flag: no row = visible (the common case), a row = hidden.
-- Toggling is therefore a plain insert-or-delete from the normal
-- authenticated client (not the service-role admin client) — same as how
-- accounts.is_pinned toggles work today, just without needing an update.
--
-- Deliberately only select/insert/delete policies below (no `update` —
-- rows are never updated, only created/removed), unlike the usual 4-policy
-- shape copied from 20260816020000_money_accounts.sql.

create table if not exists public.starling_hidden_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- Starling's savingsGoalUid (or spaceUid for a spending/round-up space).
  space_external_id text not null,
  created_at timestamptz not null default now()
);

alter table public.starling_hidden_spaces enable row level security;

drop policy if exists "Select own starling hidden spaces" on public.starling_hidden_spaces;
drop policy if exists "Insert own starling hidden spaces" on public.starling_hidden_spaces;
drop policy if exists "Delete own starling hidden spaces" on public.starling_hidden_spaces;

create policy "Select own starling hidden spaces" on public.starling_hidden_spaces for select to authenticated using (auth.uid() = user_id);
create policy "Insert own starling hidden spaces" on public.starling_hidden_spaces for insert to authenticated with check (auth.uid() = user_id);
create policy "Delete own starling hidden spaces" on public.starling_hidden_spaces for delete to authenticated using (auth.uid() = user_id);

revoke all on public.starling_hidden_spaces from anon;
grant select, insert, delete on public.starling_hidden_spaces to authenticated;

create index if not exists starling_hidden_spaces_user_id_idx on public.starling_hidden_spaces(user_id);

create unique index if not exists starling_hidden_spaces_user_account_space_key
  on public.starling_hidden_spaces (user_id, account_id, space_external_id);
