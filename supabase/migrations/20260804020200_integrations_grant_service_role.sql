-- The OAuth callback and lib/google/token.ts write/read public.integrations
-- via the service-role client (lib/supabase/admin.ts), not the cookie-based
-- one — the Vault RPCs it also calls are service_role-only. But
-- 20260804010200_integrations_table.sql only granted table privileges to
-- `authenticated`, so service_role bypasses RLS (BYPASSRLS) yet still hits a
-- plain GRANT check first and gets 42501 permission denied.

grant select, insert, update, delete on public.integrations to service_role;
