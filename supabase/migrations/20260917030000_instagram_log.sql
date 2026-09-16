-- Instagram follow log (People module). No Instagram API or scraping:
-- the user screenshots their Following list (sorted "Date followed:
-- Latest") and/or the Activity "started following you" entries, has
-- Claude turn the screenshots into JSON, and pastes that into the app.
-- import_instagram_snapshot() then applies it in one transaction.
--
-- Re-runnable: `if not exists`, guarded constraints, policies dropped
-- before being re-created, `create or replace` for the function.
--
-- Design notes:
--   * One row per Instagram account the user has ever seen in an import,
--     with the current known relationship (i_follow / follows_me) and when
--     each was first seen (or the approximate date Claude read off "2d").
--   * An event is logged only the first time a relationship is seen, so
--     re-pasting the same JSON is harmless (unique (account_id, kind)).
--   * A baseline import records who's already there without logging them
--     as new — use it for the very first snapshot.
--   * Unfollows are never inferred: a screenshot only ever shows the top
--     of a list, so someone missing from it proves nothing.
--   * person_id links an account to a People contact ("Add to People").
--   * Usernames are stored lowercase without "@" (Instagram usernames are
--     case-insensitive: letters, digits, "." and "_", max 30 chars). The
--     browser normalises first (lib/people/instagram-import.ts); the
--     function re-checks.

-- ----------------------------------------------------- instagram_accounts --

create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text,
  i_follow boolean not null default false,
  follows_me boolean not null default false,
  i_follow_since date,
  follows_me_since date,
  person_id uuid references public.people(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (user_id, username)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instagram_accounts_username_check') then
    alter table public.instagram_accounts
      add constraint instagram_accounts_username_check
      check (username ~ '^[a-z0-9._]{1,30}$');
  end if;
end $$;

create index if not exists instagram_accounts_person_id_idx on public.instagram_accounts (person_id);

alter table public.instagram_accounts enable row level security;

drop policy if exists "Select own instagram_accounts" on public.instagram_accounts;
drop policy if exists "Insert own instagram_accounts" on public.instagram_accounts;
drop policy if exists "Update own instagram_accounts" on public.instagram_accounts;
drop policy if exists "Delete own instagram_accounts" on public.instagram_accounts;
create policy "Select own instagram_accounts" on public.instagram_accounts for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own instagram_accounts" on public.instagram_accounts for insert to authenticated
  with check (
    auth.uid() = user_id
    and (person_id is null or exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid()))
  );
create policy "Update own instagram_accounts" on public.instagram_accounts for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (person_id is null or exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid()))
  );
create policy "Delete own instagram_accounts" on public.instagram_accounts for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.instagram_accounts from anon;
grant select, insert, update, delete on public.instagram_accounts to authenticated;

-- ------------------------------------------------------ instagram_imports --

create table if not exists public.instagram_imports (
  id uuid primary key default gen_random_uuid(),
  captured_on date not null,
  is_baseline boolean not null default false,
  following_count integer not null default 0,
  followers_count integer not null default 0,
  new_events integer not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

create index if not exists instagram_imports_user_id_idx on public.instagram_imports (user_id, created_at desc);

alter table public.instagram_imports enable row level security;

drop policy if exists "Select own instagram_imports" on public.instagram_imports;
drop policy if exists "Insert own instagram_imports" on public.instagram_imports;
drop policy if exists "Update own instagram_imports" on public.instagram_imports;
drop policy if exists "Delete own instagram_imports" on public.instagram_imports;
create policy "Select own instagram_imports" on public.instagram_imports for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own instagram_imports" on public.instagram_imports for insert to authenticated
  with check (auth.uid() = user_id);
-- The import function (security invoker) fills in new_events at the end.
create policy "Update own instagram_imports" on public.instagram_imports for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own instagram_imports" on public.instagram_imports for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.instagram_imports from anon;
grant select, insert, update, delete on public.instagram_imports to authenticated;

-- ------------------------------------------------------- instagram_events --

create table if not exists public.instagram_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  kind text not null check (kind in ('you_followed', 'followed_you')),
  occurred_on date not null,
  import_id uuid references public.instagram_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (account_id, kind)
);

create index if not exists instagram_events_user_day_idx on public.instagram_events (user_id, occurred_on desc);

alter table public.instagram_events enable row level security;

drop policy if exists "Select own instagram_events" on public.instagram_events;
drop policy if exists "Insert own instagram_events" on public.instagram_events;
drop policy if exists "Delete own instagram_events" on public.instagram_events;
create policy "Select own instagram_events" on public.instagram_events for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own instagram_events" on public.instagram_events for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.instagram_accounts a where a.id = account_id and a.user_id = auth.uid())
  );
create policy "Delete own instagram_events" on public.instagram_events for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.instagram_events from anon;
grant select, insert, delete on public.instagram_events to authenticated;

-- ------------------------------------------- import_instagram_snapshot --

-- Payload (see lib/people/instagram-import.ts):
-- {
--   "captured_on": "2026-09-16",
--   "baseline": false,
--   "following": [{ "username": "sam.k", "display_name": "Sam K", "approx_date": "2026-09-14" }],
--   "followers": [{ "username": "jo_b", "display_name": null, "approx_date": null }]
-- }
-- Returns { import_id, new_accounts, new_following, new_followers }.
create or replace function public.import_instagram_snapshot(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_captured date;
  v_baseline boolean;
  v_import uuid;
  v_entry jsonb;
  v_username text;
  v_display text;
  v_day date;
  v_approx date;
  v_account public.instagram_accounts%rowtype;
  v_existed boolean;
  v_new_accounts integer := 0;
  v_new_following integer := 0;
  v_new_followers integer := 0;
  v_side text;
  v_list jsonb;
begin
  begin
    v_captured := (p->>'captured_on')::date;
  exception when others then
    raise exception 'captured_on must be a date (YYYY-MM-DD)';
  end;
  if v_captured is null then
    raise exception 'captured_on is required';
  end if;
  if v_captured > current_date + 1 then
    raise exception 'captured_on is in the future';
  end if;
  v_baseline := coalesce((p->>'baseline')::boolean, false);

  insert into public.instagram_imports (captured_on, is_baseline, following_count, followers_count)
  values (
    v_captured,
    v_baseline,
    coalesce(jsonb_array_length(case when jsonb_typeof(p->'following') = 'array' then p->'following' end), 0),
    coalesce(jsonb_array_length(case when jsonb_typeof(p->'followers') = 'array' then p->'followers' end), 0)
  )
  returning id into v_import;

  foreach v_side in array array['following', 'followers']
  loop
    v_list := case when jsonb_typeof(p->v_side) = 'array' then p->v_side else '[]'::jsonb end;

    for v_entry in select value from jsonb_array_elements(v_list)
    loop
      v_username := lower(ltrim(btrim(coalesce(v_entry->>'username', '')), '@'));
      if v_username !~ '^[a-z0-9._]{1,30}$' then
        raise exception 'Not a valid Instagram username: "%"', v_entry->>'username';
      end if;
      v_display := nullif(btrim(coalesce(v_entry->>'display_name', '')), '');
      -- approx_date: optional, never after the capture date, ignored if malformed.
      begin
        v_approx := nullif(v_entry->>'approx_date', '')::date;
      exception when others then
        v_approx := null;
      end;
      if v_approx > v_captured then
        v_approx := v_captured;
      end if;
      v_day := coalesce(v_approx, v_captured);

      select * into v_account
      from public.instagram_accounts
      where username = v_username;
      v_existed := found;

      if not v_existed then
        insert into public.instagram_accounts (username, display_name)
        values (v_username, v_display)
        returning * into v_account;
        v_new_accounts := v_new_accounts + 1;
      elsif v_display is not null and v_account.display_name is distinct from v_display then
        update public.instagram_accounts
        set display_name = v_display, updated_at = now()
        where id = v_account.id;
      end if;

      if v_side = 'following' and not v_account.i_follow then
        update public.instagram_accounts
        set i_follow = true,
            i_follow_since = case when v_baseline then v_approx else v_day end,
            updated_at = now()
        where id = v_account.id;
        if not v_baseline then
          insert into public.instagram_events (account_id, kind, occurred_on, import_id)
          values (v_account.id, 'you_followed', v_day, v_import)
          on conflict (account_id, kind) do nothing;
          if found then
            v_new_following := v_new_following + 1;
          end if;
        end if;
      elsif v_side = 'followers' and not v_account.follows_me then
        update public.instagram_accounts
        set follows_me = true,
            follows_me_since = case when v_baseline then v_approx else v_day end,
            updated_at = now()
        where id = v_account.id;
        if not v_baseline then
          insert into public.instagram_events (account_id, kind, occurred_on, import_id)
          values (v_account.id, 'followed_you', v_day, v_import)
          on conflict (account_id, kind) do nothing;
          if found then
            v_new_followers := v_new_followers + 1;
          end if;
        end if;
      end if;
    end loop;
  end loop;

  update public.instagram_imports
  set new_events = v_new_following + v_new_followers
  where id = v_import;

  return jsonb_build_object(
    'import_id', v_import,
    'new_accounts', v_new_accounts,
    'new_following', v_new_following,
    'new_followers', v_new_followers
  );
end;
$$;

revoke all on function public.import_instagram_snapshot(jsonb) from public, anon;
grant execute on function public.import_instagram_snapshot(jsonb) to authenticated;
