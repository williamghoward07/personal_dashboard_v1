-- `npm run bb:eval` runs outside a login session, so it logs its AI calls
-- with the service-role client. That role bypasses RLS but not plain grants,
-- and `ai_usage` was only granted to `authenticated`.
--
-- Append-only stays append-only: select and insert, no update or delete.
-- Re-runnable: a grant that already exists is a no-op.

grant select, insert on public.ai_usage to service_role;
