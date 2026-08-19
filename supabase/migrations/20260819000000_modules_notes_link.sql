-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Placeholder field for the future second-brain notes integration
-- (OneNote via Microsoft Graph, or whatever notes source is chosen —
-- named provider-agnostically on purpose, not `onenote_url`). Lets a
-- module link out to its notes section/page now, ahead of any actual
-- fetch/index integration being built.

alter table public.modules
  add column if not exists notes_link text;
