-- Adds a free-text category column to instagram_follows, filled in by
-- hand over time (like places.category, but not a strict check-constraint
-- enum — Instagram follows span far more shapes than places' fixed set).
-- Nullable; the import/upsert path (upsertFollows) never touches it.

alter table public.instagram_follows add column if not exists category text;

create index if not exists instagram_follows_user_category_idx
  on public.instagram_follows (user_id, category);
 