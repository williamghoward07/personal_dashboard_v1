-- Extends the existing integrations table (20260804010200) so it can back the
-- Google Contacts connection for the People module.
--
-- Deviation from that table's original comment: the refresh token is stored
-- here in encrypted_refresh_token rather than in Supabase Vault. It is sealed
-- with AES-256-GCM in the application layer (lib/crypto.ts) using
-- INTEGRATION_ENCRYPTION_KEY, which lives only in the server environment and
-- never in the database. A leak of the database alone therefore yields no
-- usable token. vault_secret_name is left in place, unused, for whichever
-- future integration wants it.

alter table public.integrations
  add column if not exists encrypted_refresh_token text,
  add column if not exists sync_token text,
  add column if not exists account_email text;

comment on column public.integrations.encrypted_refresh_token is
  'AES-256-GCM sealed OAuth refresh token, formatted iv:authTag:ciphertext (base64). Never a plaintext token.';
comment on column public.integrations.sync_token is
  'Google People API syncToken for incremental connection sync. Cleared on 410 Gone to force a full resync.';

-- One row per provider per user, so the OAuth callback can upsert on reconnect
-- instead of accumulating stale rows.
create unique index if not exists integrations_user_provider_idx
  on public.integrations(user_id, provider);
