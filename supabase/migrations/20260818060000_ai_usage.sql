-- AI usage tracking: every generateStructured() call records real token
-- counts + an estimated cost here — see lib/ai/usage.ts. Backs the daily
-- call cap (assertUnderDailyBudget) and the AI Usage bento widget.
-- Owner-scoped RLS from the start, matching every other table (see
-- 20260804010100_owner_scoped_rls.sql). Append-only log — no update/delete
-- policies.

create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  day           date not null default ((now() at time zone 'Europe/London')::date),
  feature       text not null,
  tier          text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  est_cost_usd  numeric(10,6) not null default 0,
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.ai_usage enable row level security;

create policy "Select own ai_usage" on public.ai_usage for select to authenticated using (auth.uid() = user_id);
create policy "Insert own ai_usage" on public.ai_usage for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.ai_usage from anon;
grant select, insert on public.ai_usage to authenticated;

create index if not exists ai_usage_day_idx on public.ai_usage(day);
create index if not exists ai_usage_user_id_idx on public.ai_usage(user_id);
