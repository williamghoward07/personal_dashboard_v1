-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Phase 1 of the habits-system consolidation: daily_goal_habits /
-- daily_goal_habit_completions was originally scoped narrower than what
-- the shipped Habits page actually needs (icon, description,
-- quantifiable value tracking, ordering) — see 20260807000100's own
-- header comment. This migration extends the table to the full shape,
-- then migrates existing rows over from the older habits / habit_logs
-- tables so the Habits page and widget can be repointed at the new,
-- widget-scoped table CLAUDE.md's habit model describes.
--
-- habits / habit_logs are deliberately NOT dropped here — kept as an
-- untouched rollback safety net. Drop them in a deliberate follow-up
-- migration once the app has run for real on the new tables for a few
-- days.

alter table public.daily_goal_habits
  add column if not exists icon text not null default '⭐',
  add column if not exists description text not null default '',
  add column if not exists is_quantifiable boolean not null default false,
  add column if not exists target_value numeric,
  add column if not exists unit text,
  add column if not exists sort_order integer not null default 0;

alter table public.daily_goal_habit_completions
  add column if not exists value numeric;

-- Migrate habits -> daily_goal_habits, preserving id so habit_logs'
-- habit_id foreign keys still resolve correctly against the new table
-- without needing a separate id-remapping step. sort_order is assigned
-- from each user's existing created_at order, so migrated habits keep
-- their current relative order until reordered by hand.
insert into public.daily_goal_habits (
  id, name, icon, description, frequency_type, weekly_target, widget,
  colour, is_active, is_quantifiable, target_value, unit, sort_order,
  created_at, user_id
)
select
  h.id,
  h.name,
  h.icon,
  h.description,
  case h.frequency_type when 'weekly' then 'times_per_week' else 'daily' end,
  case h.frequency_type when 'weekly' then h.frequency_count else null end,
  'habits',
  h.color,
  true,
  h.is_quantifiable,
  h.target_value,
  h.unit,
  (row_number() over (partition by h.user_id order by h.created_at) - 1)::integer,
  h.created_at,
  h.user_id
from public.habits h
where not exists (
  select 1 from public.daily_goal_habits dgh where dgh.id = h.id
);

-- Migrate habit_logs -> daily_goal_habit_completions, same id-preserving
-- approach. The new schema derives "met" from value >= target_value
-- rather than storing a separate completed flag, so a below-target
-- quantifiable log still needs its row carried over (it renders as
-- "partial" on the heatmap) — only a log that is neither completed nor
-- has a value would be meaningless to keep, and the app has never
-- written such a row.
insert into public.daily_goal_habit_completions (
  id, habit_id, completed_on, value, created_at, user_id
)
select
  l.id,
  l.habit_id,
  l.date,
  l.value,
  l.created_at,
  l.user_id
from public.habit_logs l
where (l.completed or l.value is not null)
  and not exists (
    select 1 from public.daily_goal_habit_completions c where c.id = l.id
  );
