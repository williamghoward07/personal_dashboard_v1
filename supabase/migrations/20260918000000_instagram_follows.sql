-- Replaces the screenshot-based Instagram log (20260917030000) with an
-- import of Instagram's own "Download your information" export
-- (following.json), which carries real followed-at timestamps instead of
-- Claude's best-effort reading of relative times off a screenshot.
--
-- Re-runnable: `if not exists`, `drop ... if exists`, policies dropped
-- before being re-created.

-- ------------------------------------------------- drop the old system --

drop function if exists public.import_instagram_snapshot(jsonb);
drop table if exists public.instagram_events;
drop table if exists public.instagram_imports;
drop table if exists public.instagram_accounts;

-- ------------------------------------------------- instagram_follows --

create table if not exists public.instagram_follows (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  display_name text,
  note text,
  followed_at timestamptz not null default now(),
  person_id uuid references public.people(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (user_id, handle)
);

alter table public.instagram_follows enable row level security;

drop policy if exists "Select own instagram_follows" on public.instagram_follows;
drop policy if exists "Insert own instagram_follows" on public.instagram_follows;
drop policy if exists "Update own instagram_follows" on public.instagram_follows;
drop policy if exists "Delete own instagram_follows" on public.instagram_follows;

create policy "Select own instagram_follows" on public.instagram_follows for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own instagram_follows" on public.instagram_follows for insert to authenticated
  with check (
    auth.uid() = user_id
    and (person_id is null or exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid()))
  );
create policy "Update own instagram_follows" on public.instagram_follows for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (person_id is null or exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid()))
  );
create policy "Delete own instagram_follows" on public.instagram_follows for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.instagram_follows from anon;
grant select, insert, update, delete on public.instagram_follows to authenticated;

create index if not exists instagram_follows_person_id_idx on public.instagram_follows (person_id);
create index if not exists instagram_follows_user_followed_idx on public.instagram_follows (user_id, followed_at desc);
