-- Links a module to a specific OneNote section for read-only, on-demand
-- browsing (see lib/microsoft/graph.ts). Kept separate from notes_link,
-- which stays as a manual external-link fallback. section_name is cached
-- purely for display so the module edit modal doesn't need a Graph call
-- just to show what's currently linked.

alter table public.modules add column if not exists onenote_section_id text;
alter table public.modules add column if not exists onenote_section_name text;
