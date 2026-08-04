-- Part 1 of the auth lockdown: add a user_id column to every existing
-- public table ahead of switching RLS from "allow all" to owner-scoped
-- policies (see the migration that follows this one).
--
-- This is a single-user app today, so there is exactly one Google account
-- to backfill onto existing rows. Steps, in order:
--   1. add the column nullable (safe on tables that already have rows)
--   2. backfill existing rows to your auth.users id (commented out below —
--      uncomment and paste your uid before running, see instructions)
--   3. set not null and default auth.uid() so future inserts from the
--      authenticated client populate it automatically
--
-- To find your uid after signing in once with Google: Supabase Dashboard >
-- Authentication > Users, or `select id, email from auth.users;` in the
-- SQL editor.

-- Step 1: add nullable user_id to every table.
alter table public.years add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.modules add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.topics add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.prompts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.perplexity_links add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.task_research_links add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.habits add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.habit_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.rugby_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.time_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.transactions add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Step 2: backfill existing rows. Sign in with Google once first so
-- auth.users has a row, grab your uid, then uncomment and run this block.
do $$
declare
  target_uid uuid := '181c6366-2140-434f-a9c1-af83ac0f73ce';
begin
  update public.years set user_id = target_uid where user_id is null;
  update public.modules set user_id = target_uid where user_id is null;
  update public.tasks set user_id = target_uid where user_id is null;
  update public.topics set user_id = target_uid where user_id is null;
  update public.prompts set user_id = target_uid where user_id is null;
  update public.perplexity_links set user_id = target_uid where user_id is null;
  update public.task_research_links set user_id = target_uid where user_id is null;
  update public.habits set user_id = target_uid where user_id is null;
  update public.habit_logs set user_id = target_uid where user_id is null;
  update public.rugby_sessions set user_id = target_uid where user_id is null;
  update public.time_logs set user_id = target_uid where user_id is null;
  update public.transactions set user_id = target_uid where user_id is null;
end $$;

-- Step 3: enforce not null and default to the calling user going forward.
-- Run this only after the backfill above has completed successfully.
alter table public.years alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.modules alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.tasks alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.topics alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.prompts alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.perplexity_links alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.task_research_links alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.habits alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.habit_logs alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.rugby_sessions alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.time_logs alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.transactions alter column user_id set not null, alter column user_id set default auth.uid();
