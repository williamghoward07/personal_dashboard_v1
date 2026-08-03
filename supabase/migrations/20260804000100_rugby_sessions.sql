-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
-- Adds real storage for manually logged rugby sessions on the Health page.

create table if not exists public.rugby_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  duration_minutes integer,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.rugby_sessions enable row level security;
create policy "Allow all" on public.rugby_sessions for all using (true) with check (true);
grant select, insert, update, delete on public.rugby_sessions to anon, authenticated;
