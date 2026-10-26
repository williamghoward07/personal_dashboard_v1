-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Education: lets a todo be attached to a specific OneNote page ("notes
-- document") rather than just a whole module, so a document can show a
-- completion progress bar. OneNote pages themselves are never persisted
-- (fetched live from Graph, per modules.onenote_section_id) — this table
-- is the local row a todo actually links to, created the first time a
-- page gains its first linked todo. Mirrors todo_lists' shape/RLS.

create table if not exists public.notes_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  onenote_page_id text not null,
  page_title text not null,
  created_at timestamptz not null default now(),
  -- Reopening "attach todos" on the same page must reuse its row, not
  -- create a duplicate — enforced here so the app can upsert on conflict
  -- instead of racing a select-then-insert.
  unique (module_id, onenote_page_id)
);

alter table public.notes_documents enable row level security;
drop policy if exists "Select own notes_documents" on public.notes_documents;
create policy "Select own notes_documents" on public.notes_documents for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own notes_documents" on public.notes_documents;
create policy "Insert own notes_documents" on public.notes_documents for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own notes_documents" on public.notes_documents;
create policy "Update own notes_documents" on public.notes_documents for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own notes_documents" on public.notes_documents;
create policy "Delete own notes_documents" on public.notes_documents for delete to authenticated using (auth.uid() = user_id);
revoke all on public.notes_documents from anon;
grant select, insert, update, delete on public.notes_documents to authenticated;

create index if not exists notes_documents_module_id_idx on public.notes_documents(module_id);

-- Deleting a document un-attaches its todos rather than deleting them —
-- same on delete set null semantics as todos.list_id.
alter table public.todos add column if not exists notes_document_id uuid references public.notes_documents(id) on delete set null;

create index if not exists todos_notes_document_id_idx on public.todos(notes_document_id);
