-- Structural seed for the topical index: the 7 struggle categories
-- themselves. Deliberately does NOT seed bible_topic_passages — picking
-- 5-8 curated passages + a one-line reason per topic is content-authoring
-- work, not a schema task, and isn't fabricated here. That content lands in
-- a small follow-up migration (or is inserted directly via the Supabase SQL
-- editor, same as every other seed/reference edit in this project — see the
-- plan's Decision 2 for why this ships as migrations rather than a
-- runtime-imported JSON file).
--
-- user_id's `default auth.uid()` only resolves inside an authenticated
-- app request (a real JWT) — the Supabase SQL editor runs as an
-- unauthenticated role, so auth.uid() is null there and the column default
-- can't fire. Looked up directly from auth.users instead, same workaround
-- used by the daily_goal_habits seed (20260807000100_daily_goal_habits.sql)
-- for the same reason. Safe only because this is a single-user app.
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users limit 1;

  insert into public.bible_topics (slug, label, sort_order, user_id) values
    ('anxiety', 'Anxiety', 1, v_user_id),
    ('grief', 'Grief', 2, v_user_id),
    ('doubt', 'Doubt', 3, v_user_id),
    ('anger', 'Anger', 4, v_user_id),
    ('guilt', 'Guilt', 5, v_user_id),
    ('decisions', 'Decisions', 6, v_user_id),
    ('loneliness', 'Loneliness', 7, v_user_id)
  on conflict (user_id, slug) do nothing;
end $$;
