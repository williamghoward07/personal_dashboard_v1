-- The Google contacts sync upsert (app/api/google/contacts/sync/route.ts) does
-- .upsert(mapped, { onConflict: 'user_id,google_resource_name' }), which Postgres
-- resolves to ON CONFLICT (user_id, google_resource_name). That only matches a
-- unique index with no predicate; people_google_resource_idx from
-- 20260810000000_people_crm.sql is partial ("where google_resource_name is not
-- null"), so Postgres reports "no unique or exclusion constraint matching the ON
-- CONFLICT specification" on every sync.
--
-- The partial predicate was unnecessary: Postgres unique indexes already treat
-- every NULL as distinct from every other NULL, so manually-added people (null
-- google_resource_name) still never collide with each other under a plain index.

drop index if exists public.people_google_resource_idx;

create unique index if not exists people_google_resource_idx
  on public.people(user_id, google_resource_name);
