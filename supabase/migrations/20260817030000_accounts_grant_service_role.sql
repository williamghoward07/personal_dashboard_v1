-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- app/api/starling/sync/route.ts reads/writes public.accounts via the
-- service-role client (lib/supabase/admin.ts), same as
-- 20260804020200_integrations_grant_service_role.sql for integrations. But
-- 20260816020000_money_accounts.sql only granted table privileges to
-- `authenticated`, so service_role bypasses RLS (BYPASSRLS) yet still hits a
-- plain GRANT check first and gets 42501 "permission denied for table
-- accounts" — this is why Starling sync has been failing.

grant select, insert, update, delete on public.accounts to service_role;
