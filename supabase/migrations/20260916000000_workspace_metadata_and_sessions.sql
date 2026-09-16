-- Workspaces phase 2: the metadata the styled UI needs, plus session logging.
--
-- Purely additive to 20260828000000_workspaces.sql — every statement is
-- `if not exists`, so this applies cleanly whether or not that migration
-- has already been run (run them in filename order either way).
--
-- Design notes:
--   * workspace_links.kind drives the ALL/PAPERS/DATA/DOCS filter chips,
--     the per-card type icon, and the "Working set footprint" breakdown.
--     Auto-detected from the URL on add (see lib/workspaces/kinds.ts),
--     correctable per card afterwards.
--   * meta_label is display-only free text ("4.2 MB", "3,410 words") —
--     deliberately never parsed, so it can hold whatever a source needs.
--   * workspace_notes.kind gives each Thinking Log entry its coloured
--     timeline dot and badge; footnote is the muted line underneath
--     ("Pinned to: Section 2", "Flagged unreliable — excluded from…").
--     Both are written at INSERT time only: workspace_notes is append-only
--     and still has no update/delete policy or grant, which this migration
--     deliberately does not change.
--   * workspace_sessions is timestamped rows, one per workspace open, per
--     this repo's convention of never using a counter column. It backs
--     "Last session 2h ago" in the header and "18 total sessions" in the
--     footer.

-- ------------------------------------------------------------ workspaces --

alter table public.workspaces add column if not exists subtitle text;

-- -------------------------------------------------------- workspace_links --

alter table public.workspace_links add column if not exists kind text not null default 'other';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_links_kind_check'
  ) then
    alter table public.workspace_links
      add constraint workspace_links_kind_check check (kind in ('paper','data','doc','other'));
  end if;
end $$;

alter table public.workspace_links add column if not exists citation text;
alter table public.workspace_links add column if not exists doi text;
alter table public.workspace_links add column if not exists meta_label text;

create index if not exists workspace_links_kind_idx on public.workspace_links(workspace_id, kind);

-- -------------------------------------------------------- workspace_notes --

alter table public.workspace_notes add column if not exists kind text not null default 'note';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_notes_kind_check'
  ) then
    alter table public.workspace_notes
      add constraint workspace_notes_kind_check
      check (kind in ('realization','discarded','argument','meeting','note'));
  end if;
end $$;

alter table public.workspace_notes add column if not exists footnote text;

-- ----------------------------------------------------- workspace_sessions --

create table if not exists public.workspace_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.workspace_sessions enable row level security;

create policy "Select own workspace_sessions" on public.workspace_sessions for select to authenticated using (auth.uid() = user_id);
create policy "Insert own workspace_sessions" on public.workspace_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own workspace_sessions" on public.workspace_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own workspace_sessions" on public.workspace_sessions for delete to authenticated using (auth.uid() = user_id);

revoke all on public.workspace_sessions from anon;
grant select, insert, update, delete on public.workspace_sessions to authenticated;

create index if not exists workspace_sessions_user_id_idx on public.workspace_sessions(user_id);
create index if not exists workspace_sessions_workspace_id_idx on public.workspace_sessions(workspace_id);
create index if not exists workspace_sessions_started_at_idx on public.workspace_sessions(workspace_id, started_at desc);
