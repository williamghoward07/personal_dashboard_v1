-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Lets the user hide an account they don't want cluttering the Money page
-- grid, same idea as starling_hidden_spaces (20260822010000) for pots but
-- simpler: an account is already a first-class row this app owns, so it's
-- a plain boolean column toggled the same way as accounts.is_pinned
-- (20260816020000) rather than a separate presence-table.

alter table public.accounts
  add column if not exists is_hidden boolean not null default false;
