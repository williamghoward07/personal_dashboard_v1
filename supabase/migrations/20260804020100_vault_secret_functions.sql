-- Supabase Vault's `vault` schema is intentionally not exposed over
-- PostgREST, so the service-role client can't call vault.create_secret /
-- vault.update_secret / vault.decrypted_secrets directly via supabase-js.
-- These SECURITY DEFINER wrappers live in `public` (where PostgREST can see
-- them) and are grant-restricted to `service_role` only, so plain
-- `authenticated` users can never read or write vault secrets even indirectly.
--
-- Used by the Google Calendar OAuth token storage (app/auth/callback,
-- lib/google/token.ts) to keep refresh/access tokens out of plaintext
-- columns entirely.

create or replace function public.vault_upsert_secret(secret_name text, secret_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = secret_name;

  if existing_id is not null then
    perform vault.update_secret(existing_id, secret_value);
  else
    perform vault.create_secret(secret_value, secret_name);
  end if;
end;
$$;

create or replace function public.vault_read_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name = secret_name;

  return secret_value;
end;
$$;

revoke all on function public.vault_upsert_secret(text, text) from public, anon, authenticated;
revoke all on function public.vault_read_secret(text) from public, anon, authenticated;
grant execute on function public.vault_upsert_secret(text, text) to service_role;
grant execute on function public.vault_read_secret(text) to service_role;
