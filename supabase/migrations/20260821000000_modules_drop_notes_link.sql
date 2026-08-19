-- Removed in favour of the OneNote section picker (onenote_section_id /
-- onenote_section_name, added in 20260820000000) — a manual pasted link
-- is no longer needed now that modules can browse a live section in-app.

alter table public.modules drop column if exists notes_link;
