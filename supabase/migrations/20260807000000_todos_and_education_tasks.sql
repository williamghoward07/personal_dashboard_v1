-- Daily Goals widget: general to-dos (todos) and education-specific
-- to-dos (education_tasks) as two separate tables.
--
-- education_tasks is deliberately NOT the existing public.tasks table
-- (which already powers the Academic Board with module_id/status/grade/
-- credit_weight). This is a decoupled, lightweight due/done shape for
-- the Daily Goals roll-up only — see conversation decision 2026-08-07.
--
-- Created owner-scoped from the start, matching the treatment in
-- 20260804010200_integrations_table.sql.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.todos enable row level security;
create policy "Select own todos" on public.todos for select to authenticated using (auth.uid() = user_id);
create policy "Insert own todos" on public.todos for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own todos" on public.todos for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own todos" on public.todos for delete to authenticated using (auth.uid() = user_id);
revoke all on public.todos from anon;
grant select, insert, update, delete on public.todos to authenticated;

create index if not exists todos_user_id_idx on public.todos(user_id);
create index if not exists todos_due_date_idx on public.todos(due_date);

create table if not exists public.education_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  module_id uuid references public.modules(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.education_tasks enable row level security;
create policy "Select own education_tasks" on public.education_tasks for select to authenticated using (auth.uid() = user_id);
create policy "Insert own education_tasks" on public.education_tasks for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own education_tasks" on public.education_tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own education_tasks" on public.education_tasks for delete to authenticated using (auth.uid() = user_id);
revoke all on public.education_tasks from anon;
grant select, insert, update, delete on public.education_tasks to authenticated;

create index if not exists education_tasks_user_id_idx on public.education_tasks(user_id);
create index if not exists education_tasks_due_date_idx on public.education_tasks(due_date);
create index if not exists education_tasks_module_id_idx on public.education_tasks(module_id);
