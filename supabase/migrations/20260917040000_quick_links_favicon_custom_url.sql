-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- App Library: lets a link's favicon be overridden by hand instead of only
-- the auto-detected one (see lib/favicon.ts). Stored as a plain image URL
-- rendered directly client-side (app/components/widgets/app-launcher/
-- FaviconTile.tsx) rather than fetched/cached into the `link-favicons`
-- bucket, since that bucket is keyed by domain and shared across every
-- link to that domain — a per-link override can't write there without
-- clobbering other links' favicons.

alter table public.quick_links
  add column if not exists favicon_custom_url text;
