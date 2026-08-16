-- Daily Goals widget: habit scheduling for the roll-up ring.
--
-- Named daily_goal_habits / daily_goal_habit_completions rather than
-- habits/habit_completions because public.habits + public.habit_logs
-- already exist with a different shape (icon/description/is_quantifiable/
-- target_value/unit, frequency_type 'daily'|'weekly') and power the
-- Habit Board (HabitBoard/HabitCard/HabitHeatmap) plus GoalTicker. This
-- is a separate, newer scheduling model (specific_days / times_per_week
-- / widget-scoped) for the Daily Goals widget specifically, not a
-- migration of the old one — see conversation decision 2026-08-07.
--
-- Created owner-scoped from the start, matching the treatment in
-- 20260804010200_integrations_table.sql.

create table if not exists public.daily_goal_habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  frequency_type text not null check (frequency_type in ('daily', 'specific_days', 'times_per_week')),
  -- ISO-8601 weekday numbers, 1=Monday..7=Sunday. Only meaningful (and
  -- expected non-null) when frequency_type = 'specific_days'.
  days_of_week integer[],
  -- Only meaningful when frequency_type = 'times_per_week'.
  weekly_target integer,
  widget text not null check (widget in ('habits', 'health')),
  colour text not null default '#849587',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  constraint daily_goal_habits_specific_days_check
    check (frequency_type <> 'specific_days' or days_of_week is not null),
  constraint daily_goal_habits_times_per_week_check
    check (frequency_type <> 'times_per_week' or weekly_target is not null)
);

alter table public.daily_goal_habits enable row level security;
create policy "Select own daily_goal_habits" on public.daily_goal_habits for select to authenticated using (auth.uid() = user_id);
create policy "Insert own daily_goal_habits" on public.daily_goal_habits for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own daily_goal_habits" on public.daily_goal_habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own daily_goal_habits" on public.daily_goal_habits for delete to authenticated using (auth.uid() = user_id);
revoke all on public.daily_goal_habits from anon;
grant select, insert, update, delete on public.daily_goal_habits to authenticated;

create index if not exists daily_goal_habits_user_id_idx on public.daily_goal_habits(user_id);

-- One row per habit per day it was completed. The unique constraint lets
-- a "log today" action use a single upsert, and is what lets weekly
-- counts, streaks and history be derived rather than stored as a
-- boolean on the habit itself.
create table if not exists public.daily_goal_habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.daily_goal_habits(id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (habit_id, completed_on)
);

alter table public.daily_goal_habit_completions enable row level security;
create policy "Select own daily_goal_habit_completions" on public.daily_goal_habit_completions for select to authenticated using (auth.uid() = user_id);
create policy "Insert own daily_goal_habit_completions" on public.daily_goal_habit_completions for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own daily_goal_habit_completions" on public.daily_goal_habit_completions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own daily_goal_habit_completions" on public.daily_goal_habit_completions for delete to authenticated using (auth.uid() = user_id);
revoke all on public.daily_goal_habit_completions from anon;
grant select, insert, update, delete on public.daily_goal_habit_completions to authenticated;

create index if not exists daily_goal_habit_completions_user_id_idx on public.daily_goal_habit_completions(user_id);
create index if not exists daily_goal_habit_completions_habit_id_idx on public.daily_goal_habit_completions(habit_id);
create index if not exists daily_goal_habit_completions_completed_on_idx on public.daily_goal_habit_completions(completed_on);

-- Seed: two health habits, both times_per_week. Weekly targets are
-- configurable columns, not hard-coded logic — Running defaults to 1
-- (per spec), Gym defaults to 3; edit either seeded row's weekly_target
-- to taste after running this.
--
-- Single-user app (see 20260804010000_add_user_id_columns.sql) — reuses
-- the same hardcoded uid from that migration, since the SQL editor's
-- connection has no JWT/auth.uid() context to populate the not-null
-- user_id column with otherwise.
do $$
declare
  target_uid uuid := '181c6366-2140-434f-a9c1-af83ac0f73ce';
begin
  insert into public.daily_goal_habits (name, frequency_type, weekly_target, widget, colour, user_id)
  select 'Running', 'times_per_week', 1, 'health', '#00ff9d', target_uid
  where not exists (
    select 1 from public.daily_goal_habits where name = 'Running' and user_id = target_uid
  );

  insert into public.daily_goal_habits (name, frequency_type, weekly_target, widget, colour, user_id)
  select 'Gym', 'times_per_week', 3, 'health', '#00ff9d', target_uid
  where not exists (
    select 1 from public.daily_goal_habits where name = 'Gym' and user_id = target_uid
  );
end $$;
