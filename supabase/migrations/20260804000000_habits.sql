-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
-- Adds real storage for the habit tracker page.
-- RLS is enabled with a permissive "allow all" policy on each table,
-- consistent with the existing tables, plus explicit grants to
-- anon/authenticated (a policy alone does not grant table-level access).

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '⭐',
  description text not null default '',
  color text not null default '#2a78d6',
  -- Cadence: 'daily' means once a day; 'weekly' means frequency_count times
  -- a week (e.g. 3 for "3x / week"), matching the streak-goal pattern from
  -- the reference habit-tracker app.
  frequency_type text not null default 'daily' check (frequency_type in ('daily', 'weekly')),
  frequency_count integer not null default 1,
  -- Quantifiable habits (e.g. "read 20 pages", "run 5km") log a numeric
  -- value per day instead of a plain done/not-done checkmark.
  is_quantifiable boolean not null default false,
  target_value numeric,
  unit text,
  created_at timestamptz not null default now()
);
alter table public.habits enable row level security;
create policy "Allow all" on public.habits for all using (true) with check (true);
grant select, insert, update, delete on public.habits to anon, authenticated;

-- One row per habit per day it was logged. The unique constraint lets the
-- "toggle/log today" action use a single upsert. `value` carries the
-- quantity for quantifiable habits; `completed` covers the plain case and,
-- for quantifiable habits, whether that day's value met the target.
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  value numeric,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);
alter table public.habit_logs enable row level security;
create policy "Allow all" on public.habit_logs for all using (true) with check (true);
grant select, insert, update, delete on public.habit_logs to anon, authenticated;

create index if not exists habit_logs_habit_id_idx on public.habit_logs(habit_id);
