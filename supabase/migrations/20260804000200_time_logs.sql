-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
-- Adds real storage for time logged against a task, used by the
-- time-tracking widget in the Education page's task detail view.

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  date date not null default current_date,
  minutes_spent integer not null,
  created_at timestamptz not null default now()
);
alter table public.time_logs enable row level security;
create policy "Allow all" on public.time_logs for all using (true) with check (true);
grant select, insert, update, delete on public.time_logs to anon, authenticated;

create index if not exists time_logs_task_id_idx on public.time_logs(task_id);
