-- App Library: archive links and folders instead of deleting them.
--
-- Re-runnable (`if not exists` throughout). Mirrors workspaces.archived_at
-- (20260828000000_workspaces.sql): a nullable timestamp rather than a
-- boolean, so "archived when" comes for free.
--
-- Design notes:
--   * An archived folder hides itself and every link in it; the links keep
--     their own archived_at untouched, so unarchiving the folder brings
--     back exactly what was there.
--   * Archived links keep their sort_order. quick_links.sort_order is one
--     global sequence (lib/app-launcher/order.ts); drag renumbering only
--     touches active links, and unarchiving appends the link to the end.

alter table public.quick_links add column if not exists archived_at timestamptz;
alter table public.link_folders add column if not exists archived_at timestamptz;

create index if not exists quick_links_active_idx
  on public.quick_links (user_id, sort_order) where archived_at is null;
create index if not exists link_folders_active_idx
  on public.link_folders (user_id, sort_order) where archived_at is null;
