-- Google Calendar (and future providers) upsert on (user_id, provider) from
-- the OAuth callback — without a uniqueness constraint, reconnecting would
-- insert a duplicate row instead of refreshing the existing one.

alter table public.integrations
  add constraint integrations_user_id_provider_key unique (user_id, provider);
