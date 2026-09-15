-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- App Launcher: a pinned quick-launch widget on the homepage plus a full
-- folder-based "App Library" at /apps, replacing browser bookmark syncing.
-- Links with no folder_id show under a virtual "Unfiled" folder in the UI
-- (app/components/widgets/app-launcher/AppLibraryBoard.tsx) — there is no
-- real "Unfiled" row here on purpose.

create table if not exists public.link_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  -- One of lib/theme.ts's Accent keys — reused for the folder swatch and
  -- the fallback initial-letter tile so no new hex colors are introduced.
  color text not null default 'neutral'
    check (color in ('mint','blue','orange','pink','purple','amber','crimson','neutral')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.link_folders enable row level security;

create policy "Select own link_folders" on public.link_folders for select to authenticated using (auth.uid() = user_id);
create policy "Insert own link_folders" on public.link_folders for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own link_folders" on public.link_folders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own link_folders" on public.link_folders for delete to authenticated using (auth.uid() = user_id);

revoke all on public.link_folders from anon;
grant select, insert, update, delete on public.link_folders to authenticated;

create index if not exists link_folders_user_id_idx on public.link_folders(user_id);

create table if not exists public.quick_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- Null = unfiled. Deleting a folder never cascades — the UI always makes
  -- the caller choose reassign-or-unfile first, so `set null` here is a
  -- last-resort safety net, not the primary deletion path.
  folder_id uuid references public.link_folders(id) on delete set null,
  title text not null,
  url text not null,
  -- Object path within the `link-favicons` bucket (not a full URL — see
  -- app/components/widgets/app-launcher/shared.ts's faviconPublicUrl).
  -- Null means no cached favicon yet, or the fetch failed — either way
  -- the UI falls back to a colored initial-letter tile.
  favicon_path text,
  is_pinned boolean not null default false,
  sort_order integer not null default 0,
  -- Populated on every click-to-open (see shared.ts's openQuickLink). Not
  -- read anywhere yet — reserved for a future "recently used" view.
  last_opened_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.quick_links enable row level security;

create policy "Select own quick_links" on public.quick_links for select to authenticated using (auth.uid() = user_id);
create policy "Insert own quick_links" on public.quick_links for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own quick_links" on public.quick_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own quick_links" on public.quick_links for delete to authenticated using (auth.uid() = user_id);

revoke all on public.quick_links from anon;
grant select, insert, update, delete on public.quick_links to authenticated;

create index if not exists quick_links_user_id_idx on public.quick_links(user_id);
create index if not exists quick_links_folder_id_idx on public.quick_links(folder_id);
create index if not exists quick_links_is_pinned_idx on public.quick_links(is_pinned) where is_pinned;

-- Storage: cached favicons (see lib/favicon.ts). Public bucket — favicon
-- images aren't sensitive, and a public bucket keeps the <img>-tag +
-- onError fallback pattern (PersonAvatar.tsx) trivial, no signed-URL
-- refresh needed. All writes go through the service-role admin client
-- (lib/supabase/admin.ts, called from app/api/favicon/route.ts), which
-- bypasses RLS entirely — so only a read policy is needed here.
insert into storage.buckets (id, name, public)
values ('link-favicons', 'link-favicons', true)
on conflict (id) do nothing;

create policy "Public read link-favicons" on storage.objects
  for select to public using (bucket_id = 'link-favicons');
