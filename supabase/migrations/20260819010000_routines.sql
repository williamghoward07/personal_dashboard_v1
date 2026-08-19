-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Routines: reusable, named stacks of timed steps (e.g. "Morning Routine")
-- built on the Calendar page's new Routines tab. A routine is a template
-- (routines + routine_items); scheduling it onto a specific day/time creates
-- both a real Google Calendar event and a routine_instances row linking to
-- it, so the in-app UI can show/edit the step breakdown behind what is
-- otherwise just a single opaque event on the real calendar.
--
-- Deliberately unrelated to daily_goal_habits/daily_goal_habit_completions
-- (the /habits page's daily/weekly completion-tracking system) — routines
-- have no notion of "done today", just ordered timed steps and calendar
-- placements. Named "routines" everywhere, not "habit stacks", to keep the
-- two concepts visually and terminologically separate.

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  colour text not null default '#c084fc',
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.routines enable row level security;
create policy "Select own routines" on public.routines for select to authenticated using (auth.uid() = user_id);
create policy "Insert own routines" on public.routines for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own routines" on public.routines for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own routines" on public.routines for delete to authenticated using (auth.uid() = user_id);
revoke all on public.routines from anon;
grant select, insert, update, delete on public.routines to authenticated;

create index if not exists routines_user_id_idx on public.routines(user_id);

-- Ordered steps within a routine. sort_order + a drag-to-reorder UI mirrors
-- the daily_goal_habits pattern (see HabitBoard.tsx's handleDragEnd).
create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.routine_items enable row level security;
create policy "Select own routine_items" on public.routine_items for select to authenticated using (auth.uid() = user_id);
create policy "Insert own routine_items" on public.routine_items for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own routine_items" on public.routine_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own routine_items" on public.routine_items for delete to authenticated using (auth.uid() = user_id);
revoke all on public.routine_items from anon;
grant select, insert, update, delete on public.routine_items to authenticated;

create index if not exists routine_items_user_id_idx on public.routine_items(user_id);
create index if not exists routine_items_routine_id_idx on public.routine_items(routine_id);

-- One row per scheduled placement of a routine onto a real calendar
-- day/time. routine_id is ON DELETE SET NULL (not cascade) — deleting the
-- template must never retroactively corrupt or hide an already-scheduled
-- real Google Calendar event, so routine_name/routine_colour/duration_minutes
-- are snapshotted at schedule-time and remain the source of truth for
-- rendering even after the template is gone. google_event_id is always set:
-- a row is only ever inserted after the Google event was created
-- successfully (see app/api/routines/schedule).
create table if not exists public.routine_instances (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references public.routines(id) on delete set null,
  routine_name text not null,
  routine_colour text not null,
  start_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  google_event_id text not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.routine_instances enable row level security;
create policy "Select own routine_instances" on public.routine_instances for select to authenticated using (auth.uid() = user_id);
create policy "Insert own routine_instances" on public.routine_instances for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own routine_instances" on public.routine_instances for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own routine_instances" on public.routine_instances for delete to authenticated using (auth.uid() = user_id);
revoke all on public.routine_instances from anon;
grant select, insert, update, delete on public.routine_instances to authenticated;

create index if not exists routine_instances_user_id_idx on public.routine_instances(user_id);
create index if not exists routine_instances_routine_id_idx on public.routine_instances(routine_id);
create index if not exists routine_instances_start_at_idx on public.routine_instances(start_at);
