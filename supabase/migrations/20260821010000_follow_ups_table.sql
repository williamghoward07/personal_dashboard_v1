-- Follow-ups become their own table, decoupled from interactions, so a
-- reminder to bring something up with someone can be set without first
-- having to log a conversation that hasn't actually happened yet.
-- `interaction_id` stays nullable — set when a follow-up was noted while
-- logging a real conversation, null for a standalone reminder.
--
-- Written to be safely re-runnable: every step below either uses an
-- IF NOT EXISTS-style guard or checks current state first, so re-pasting
-- this whole file after a partial failure just picks up where it left off.
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  note text not null,
  due_date date,
  done boolean not null default false,
  interaction_id uuid references public.interactions(id) on delete set null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.follow_ups enable row level security;

drop policy if exists "Select own follow_ups" on public.follow_ups;
create policy "Select own follow_ups" on public.follow_ups for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own follow_ups" on public.follow_ups;
create policy "Insert own follow_ups" on public.follow_ups for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own follow_ups" on public.follow_ups;
create policy "Update own follow_ups" on public.follow_ups for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own follow_ups" on public.follow_ups;
create policy "Delete own follow_ups" on public.follow_ups for delete to authenticated using (auth.uid() = user_id);

revoke all on public.follow_ups from anon;
grant select, insert, update, delete on public.follow_ups to authenticated;

create index if not exists follow_ups_user_id_idx on public.follow_ups(user_id);
create index if not exists follow_ups_person_id_idx on public.follow_ups(person_id);
create index if not exists follow_ups_interaction_id_idx on public.follow_ups(interaction_id);
create index if not exists follow_ups_open_idx on public.follow_ups(due_date) where done = false;

-- Backfill existing interaction-attached follow-ups, fanned out to every
-- attendee — the old model didn't scope a follow-up to one specific
-- person, so a group interaction's follow-up becomes one row per attendee.
-- Guarded on the old columns still existing, so this whole block is a
-- no-op (not an error) once a prior run has already dropped them.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interactions' and column_name = 'follow_up'
  ) then
    insert into public.follow_ups (person_id, note, done, interaction_id, created_at, user_id)
    select ip.person_id, i.follow_up, i.follow_up_done, i.id, i.created_at, i.user_id
    from public.interactions i
    join public.interaction_people ip on ip.interaction_id = i.id
    where i.follow_up is not null
      and not exists (
        select 1 from public.follow_ups f
        where f.interaction_id = i.id and f.person_id = ip.person_id
      );

    drop index if exists public.interactions_follow_up_idx;
    alter table public.interactions drop column if exists follow_up;
    alter table public.interactions drop column if exists follow_up_done;
  end if;
end $$;
