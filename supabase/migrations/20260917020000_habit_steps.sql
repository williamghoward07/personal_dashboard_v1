-- Habit steps: a habit (e.g. "Morning routine") can have ordered steps,
-- each either core or bonus. Ticking every core step for a day marks the
-- habit done for that day (a daily_goal_habit_completions row), so the
-- existing habit rings, heatmap and Daily Goals roll-up pick it up with no
-- changes. Bonus steps are extra credit and never affect completion.
--
-- Deliberately separate from Calendar routines (20260819010000_routines):
-- those are timed stacks placed on the calendar with no "done" tracking;
-- habit steps are a daily checklist with no times.
--
-- Re-runnable: `if not exists` everywhere, policies dropped before being
-- re-created, the function is `create or replace`.
--
-- Design notes:
--   * If a habit has steps but none is marked core, every step counts as
--     core (so a plain checklist still completes the habit).
--   * set_habit_step_check only ever *adds* the completion when the last
--     core step is ticked, and only *removes* it when a core step is
--     unticked. Ticking a bonus step, or a core step that doesn't finish
--     the set, leaves a completion logged by hand on /habits alone.
--   * habit_step_checks.habit_id is denormalised from the step (the RPC
--     fills it) so a day's checks for a habit are one indexed read.
--   * RLS checks ownership of the parent rows too, not just user_id.

-- ------------------------------------------------------------ habit_steps --

create table if not exists public.habit_steps (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.daily_goal_habits(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  is_core boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

create index if not exists habit_steps_habit_id_idx on public.habit_steps (habit_id, sort_order);
create index if not exists habit_steps_user_id_idx on public.habit_steps (user_id);

alter table public.habit_steps enable row level security;

drop policy if exists "Select own habit_steps" on public.habit_steps;
drop policy if exists "Insert own habit_steps" on public.habit_steps;
drop policy if exists "Update own habit_steps" on public.habit_steps;
drop policy if exists "Delete own habit_steps" on public.habit_steps;
create policy "Select own habit_steps" on public.habit_steps for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own habit_steps" on public.habit_steps for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.daily_goal_habits h where h.id = habit_id and h.user_id = auth.uid())
  );
create policy "Update own habit_steps" on public.habit_steps for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.daily_goal_habits h where h.id = habit_id and h.user_id = auth.uid())
  );
create policy "Delete own habit_steps" on public.habit_steps for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.habit_steps from anon;
grant select, insert, update, delete on public.habit_steps to authenticated;

-- ------------------------------------------------------ habit_step_checks --

create table if not exists public.habit_step_checks (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.habit_steps(id) on delete cascade,
  habit_id uuid not null references public.daily_goal_habits(id) on delete cascade,
  checked_on date not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (step_id, checked_on)
);

create index if not exists habit_step_checks_habit_day_idx on public.habit_step_checks (habit_id, checked_on);
create index if not exists habit_step_checks_user_id_idx on public.habit_step_checks (user_id);

alter table public.habit_step_checks enable row level security;

drop policy if exists "Select own habit_step_checks" on public.habit_step_checks;
drop policy if exists "Insert own habit_step_checks" on public.habit_step_checks;
drop policy if exists "Delete own habit_step_checks" on public.habit_step_checks;
create policy "Select own habit_step_checks" on public.habit_step_checks for select to authenticated
  using (auth.uid() = user_id);
create policy "Insert own habit_step_checks" on public.habit_step_checks for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.habit_steps s
      where s.id = step_id and s.habit_id = habit_step_checks.habit_id and s.user_id = auth.uid()
    )
  );
create policy "Delete own habit_step_checks" on public.habit_step_checks for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.habit_step_checks from anon;
grant select, insert, delete on public.habit_step_checks to authenticated;

-- ------------------------------------------------- set_habit_step_check --

-- Ticks or unticks one step for one day and keeps the habit's completion
-- for that day in step with its core steps, in one transaction. Security
-- invoker: every read/write goes through the RLS above.
create or replace function public.set_habit_step_check(p_step uuid, p_day date, p_checked boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_habit uuid;
  v_step_is_core boolean;
  v_flagged_core integer;
  v_core_total integer;
  v_core_checked integer;
  v_complete boolean;
begin
  select s.habit_id, s.is_core into v_habit, v_step_is_core
  from public.habit_steps s
  where s.id = p_step;

  if v_habit is null then
    raise exception 'Habit step not found';
  end if;

  if p_checked then
    insert into public.habit_step_checks (step_id, habit_id, checked_on)
    values (p_step, v_habit, p_day)
    on conflict (step_id, checked_on) do nothing;
  else
    delete from public.habit_step_checks
    where step_id = p_step and checked_on = p_day;
  end if;

  select count(*) filter (where s.is_core) into v_flagged_core
  from public.habit_steps s
  where s.habit_id = v_habit;

  select count(*), count(k.id) into v_core_total, v_core_checked
  from public.habit_steps s
  left join public.habit_step_checks k on k.step_id = s.id and k.checked_on = p_day
  where s.habit_id = v_habit and (s.is_core or v_flagged_core = 0);

  v_complete := v_core_total > 0 and v_core_checked >= v_core_total;

  if v_complete then
    insert into public.daily_goal_habit_completions (habit_id, completed_on)
    values (v_habit, p_day)
    on conflict (habit_id, completed_on) do nothing;
  elsif not p_checked and (v_step_is_core or v_flagged_core = 0) then
    delete from public.daily_goal_habit_completions
    where habit_id = v_habit and completed_on = p_day;
  end if;

  return jsonb_build_object('day_complete', v_complete);
end;
$$;

revoke all on function public.set_habit_step_check(uuid, date, boolean) from public, anon;
grant execute on function public.set_habit_step_check(uuid, date, boolean) to authenticated;
