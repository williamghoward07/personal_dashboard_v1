-- People CRM: contacts, the conversations you had with them, and the places
-- those conversations happened.
--
-- Design notes:
--   * Supabase is the source of truth. Google Contacts is a read-only source
--     for the *contact card* fields only (see 20260810000100).
--   * interaction_people is a join table so one conversation can involve
--     several people. RLS does NOT inherit through foreign keys, so it carries
--     its own user_id and its own policies.
--   * Every table is owner-scoped from birth, matching the treatment in
--     20260804010100_owner_scoped_rls.sql and 20260804010200_integrations_table.sql.

-- ---------------------------------------------------------------- places ----

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  category text not null default 'other'
    check (category in ('cafe','university','pub','restaurant','gym','office','home','event','other')),
  latitude numeric,
  longitude numeric,
  notes text,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.places enable row level security;

create policy "Select own places" on public.places for select to authenticated using (auth.uid() = user_id);
create policy "Insert own places" on public.places for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own places" on public.places for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own places" on public.places for delete to authenticated using (auth.uid() = user_id);

revoke all on public.places from anon;
grant select, insert, update, delete on public.places to authenticated;

create index if not exists places_user_id_idx on public.places(user_id);

-- ---------------------------------------------------------------- people ----

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  company text,
  job_title text,
  linkedin_url text,
  photo_url text,
  how_we_met text,
  birthday date,
  notes text,
  tags text[] not null default '{}',
  -- Google People API linkage. Null for people added by hand, which the
  -- sync therefore never touches.
  google_resource_name text,
  google_etag text,
  google_synced_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.people enable row level security;

create policy "Select own people" on public.people for select to authenticated using (auth.uid() = user_id);
create policy "Insert own people" on public.people for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own people" on public.people for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own people" on public.people for delete to authenticated using (auth.uid() = user_id);

revoke all on public.people from anon;
grant select, insert, update, delete on public.people to authenticated;

create index if not exists people_user_id_idx on public.people(user_id);

-- Upsert target for the Google sync. Partial, so the many manually-added
-- people with a null resource name don't collide with each other.
create unique index if not exists people_google_resource_idx
  on public.people(user_id, google_resource_name)
  where google_resource_name is not null;

-- ---------------------------------------------------------- interactions ----

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  title text,
  summary text not null default '',      -- what was actually discussed
  channel text not null default 'in_person'
    check (channel in ('in_person','call','video','message','email','other')),
  place_id uuid references public.places(id) on delete set null,
  follow_up text,                        -- bring this up next time
  follow_up_done boolean not null default false,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.interactions enable row level security;

create policy "Select own interactions" on public.interactions for select to authenticated using (auth.uid() = user_id);
create policy "Insert own interactions" on public.interactions for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own interactions" on public.interactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own interactions" on public.interactions for delete to authenticated using (auth.uid() = user_id);

revoke all on public.interactions from anon;
grant select, insert, update, delete on public.interactions to authenticated;

create index if not exists interactions_user_id_idx on public.interactions(user_id);
create index if not exists interactions_occurred_at_idx on public.interactions(occurred_at desc);
create index if not exists interactions_place_id_idx on public.interactions(place_id);
create index if not exists interactions_follow_up_idx on public.interactions(follow_up_done)
  where follow_up is not null;

-- --------------------------------------------------- interaction_people ----

create table if not exists public.interaction_people (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (interaction_id, person_id)
);

alter table public.interaction_people enable row level security;

create policy "Select own interaction_people" on public.interaction_people for select to authenticated using (auth.uid() = user_id);
create policy "Insert own interaction_people" on public.interaction_people for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own interaction_people" on public.interaction_people for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own interaction_people" on public.interaction_people for delete to authenticated using (auth.uid() = user_id);

revoke all on public.interaction_people from anon;
grant select, insert, update, delete on public.interaction_people to authenticated;

create index if not exists interaction_people_user_id_idx on public.interaction_people(user_id);
create index if not exists interaction_people_person_id_idx on public.interaction_people(person_id);
create index if not exists interaction_people_interaction_id_idx on public.interaction_people(interaction_id);
