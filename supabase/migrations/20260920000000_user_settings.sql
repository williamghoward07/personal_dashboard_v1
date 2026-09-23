-- user_settings: one row per user holding home-widget layout, hidden nav
-- tabs and the app-launcher's selected/ordered links (Phase P1 of the
-- home-customisation + BIO-SYSTEM frame plan). Migrations here are applied
-- by hand, so this is written re-runnable: `if not exists`, `drop policy
-- if exists`.
--
-- home_layout: [{ id, span, hidden }] in render order, tolerant-merged in
--   code against the current widget registry (lib/settings/schema.ts) so
--   adding/removing a home widget never breaks an existing row.
-- hidden_nav_items: navItems hrefs (lib/nav-items.ts) hidden from the
--   sidebar/bottom nav.
-- launcher_link_ids: quick_links.id values, in order — the single source
--   of truth for the app launcher (membership AND order in one array).
--   Supersedes quick_links.is_pinned, which is left in place but unread,
--   matching how todos.caldav_uid was retired.

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid()
    references auth.users(id) on delete cascade,
  home_layout jsonb not null default '[]'::jsonb,
  hidden_nav_items text[] not null default '{}',
  launcher_link_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Select own user_settings" on public.user_settings;
drop policy if exists "Insert own user_settings" on public.user_settings;
drop policy if exists "Update own user_settings" on public.user_settings;
drop policy if exists "Delete own user_settings" on public.user_settings;

create policy "Select own user_settings" on public.user_settings for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own user_settings" on public.user_settings for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Update own user_settings" on public.user_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Delete own user_settings" on public.user_settings for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;
