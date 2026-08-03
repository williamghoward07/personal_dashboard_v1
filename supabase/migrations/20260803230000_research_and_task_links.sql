-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
-- Adds storage for the Research page (prompts + saved Perplexity links)
-- and a join table linking either of those to a task.
--
-- years / modules / tasks / topics already exist and are left untouched.
-- RLS is enabled with a permissive "allow all" policy on each new table,
-- consistent with the existing tables (single-user app, anon key access).
-- A policy alone doesn't grant table-level access in Postgres, so each
-- table also gets an explicit grant to anon/authenticated.

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt text not null,
  created_at timestamptz not null default now()
);
alter table public.prompts enable row level security;
create policy "Allow all" on public.prompts for all using (true) with check (true);
grant select, insert, update, delete on public.prompts to anon, authenticated;

create table if not exists public.perplexity_links (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null default '',
  folder text not null default 'Unsorted',
  created_at timestamptz not null default now()
);
alter table public.perplexity_links enable row level security;
create policy "Allow all" on public.perplexity_links for all using (true) with check (true);
grant select, insert, update, delete on public.perplexity_links to anon, authenticated;

-- Links a task to exactly one research item (a prompt OR a perplexity link).
create table if not exists public.task_research_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete cascade,
  perplexity_link_id uuid references public.perplexity_links(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint task_research_links_one_target check (
    (prompt_id is not null)::int + (perplexity_link_id is not null)::int = 1
  )
);
alter table public.task_research_links enable row level security;
create policy "Allow all" on public.task_research_links for all using (true) with check (true);
grant select, insert, update, delete on public.task_research_links to anon, authenticated;

create index if not exists task_research_links_task_id_idx
  on public.task_research_links(task_id);
