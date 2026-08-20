-- Bible study module schema spine. Everything keys off bible_passages, a
-- normalised book/chapter/verse reference — never a free-text string, and
-- never scripture text itself (this module stores structure and notes only,
-- per the physical-Bible-companion design: no Bible API, no verse text, no
-- reader UI anywhere in this app).
--
-- Table shapes and RLS follow the same owner-scoped pattern as every other
-- table in this project (see e.g. 20260807000100_daily_goal_habits.sql):
-- user_id defaults to auth.uid(), RLS enabled, four auth.uid()=user_id
-- policies, anon revoked, authenticated granted.
--
-- Prefixed bible_ throughout: an unrelated `topics` table already exists
-- (Education module's per-module confidence tracker), so every new table
-- here is namespaced to avoid collision.

-- ------------------------------------------------------------ bible_passages ----

create table if not exists public.bible_passages (
  id uuid primary key default gen_random_uuid(),
  book text not null check (book in (
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
    '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
    'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
    'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
    'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
    'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
    'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
    '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
    '1 John','2 John','3 John','Jude','Revelation'
  )),
  -- Canonical 1-66 order, denormalised so listing queries can sort without
  -- a client-side lookup join. Always set by get_or_create_bible_passage(),
  -- never accepted directly from user input.
  book_order smallint not null,
  chapter smallint not null check (chapter > 0),
  -- Both null = whole-chapter reference (e.g. "Psalm 23"). verse_end null
  -- with verse_start set = a single verse. Both set = a range. This is
  -- deliberately soft-validated (no max-verse-per-chapter check) since
  -- verifying that would need a Bible API, which this module never calls.
  verse_start smallint check (verse_start > 0),
  verse_end smallint check (verse_end > 0),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  constraint bible_passages_verse_range_check
    check (verse_end is null or (verse_start is not null and verse_end >= verse_start))
);

alter table public.bible_passages enable row level security;
drop policy if exists "Select own bible_passages" on public.bible_passages;
create policy "Select own bible_passages" on public.bible_passages for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_passages" on public.bible_passages;
create policy "Insert own bible_passages" on public.bible_passages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_passages" on public.bible_passages;
create policy "Update own bible_passages" on public.bible_passages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_passages" on public.bible_passages;
create policy "Delete own bible_passages" on public.bible_passages for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_passages from anon;
grant select, insert, update, delete on public.bible_passages to authenticated;

create index if not exists bible_passages_user_id_idx on public.bible_passages(user_id);
create index if not exists bible_passages_book_chapter_idx on public.bible_passages(book, chapter);

-- Natural-key uniqueness. Two NULLs are never equal in Postgres, so a plain
-- unique index on (book, chapter, verse_start, verse_end) would let
-- duplicate whole-chapter rows (verse_start/verse_end both null) slip in.
-- COALESCE to a sentinel closes that gap.
create unique index if not exists bible_passages_natural_key_idx
  on public.bible_passages(user_id, book, chapter, coalesce(verse_start, -1), coalesce(verse_end, -1));

-- ------------------------------------------------------------- bible_studies ----

create table if not exists public.bible_studies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.bible_studies enable row level security;
drop policy if exists "Select own bible_studies" on public.bible_studies;
create policy "Select own bible_studies" on public.bible_studies for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_studies" on public.bible_studies;
create policy "Insert own bible_studies" on public.bible_studies for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_studies" on public.bible_studies;
create policy "Update own bible_studies" on public.bible_studies for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_studies" on public.bible_studies;
create policy "Delete own bible_studies" on public.bible_studies for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_studies from anon;
grant select, insert, update, delete on public.bible_studies to authenticated;

create index if not exists bible_studies_user_id_idx on public.bible_studies(user_id);

-- Enforces "one active study at a time" at the database level, not just in
-- app code. import_bible_study() relies on this raising a clean
-- unique-violation when the caller already has an active study.
create unique index if not exists bible_studies_one_active_idx
  on public.bible_studies(user_id) where status = 'active';

-- ------------------------------------------------------- bible_study_sessions ----

-- One row per passage range (the planned unit, imported with its
-- questions) — not one row per sitting. Pause/resume within a session is
-- tracked at the question level in bible_session_questions below.
create table if not exists public.bible_study_sessions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.bible_studies(id) on delete cascade,
  session_number smallint not null check (session_number > 0),
  -- restrict, not cascade: there's no passage-delete UI, so this is a
  -- safety rail against silently losing a session if one ever is deleted.
  passage_id uuid not null references public.bible_passages(id) on delete restrict,
  title text,
  started_at timestamptz,
  -- Nullable timestamp directly on the row, matching todos/education_tasks
  -- (one-off items) rather than daily_goal_habit_completions' separate
  -- dated-rows table (which exists because habits repeat and need
  -- per-occurrence history). A session doesn't repeat. Set once every
  -- question in the session is answered, or manually if marked done early.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (study_id, session_number)
);

alter table public.bible_study_sessions enable row level security;
drop policy if exists "Select own bible_study_sessions" on public.bible_study_sessions;
create policy "Select own bible_study_sessions" on public.bible_study_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_study_sessions" on public.bible_study_sessions;
create policy "Insert own bible_study_sessions" on public.bible_study_sessions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_study_sessions" on public.bible_study_sessions;
create policy "Update own bible_study_sessions" on public.bible_study_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_study_sessions" on public.bible_study_sessions;
create policy "Delete own bible_study_sessions" on public.bible_study_sessions for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_study_sessions from anon;
grant select, insert, update, delete on public.bible_study_sessions to authenticated;

create index if not exists bible_study_sessions_user_id_idx on public.bible_study_sessions(user_id);
create index if not exists bible_study_sessions_study_id_idx on public.bible_study_sessions(study_id);
create index if not exists bible_study_sessions_passage_id_idx on public.bible_study_sessions(passage_id);

-- ----------------------------------------------------- bible_session_questions ----

-- 2-4 pre-written questions per session, defined at import time. Each
-- question's own answered_at is the actual "session completion" signal —
-- richer than a single per-session flag, and it's what makes pausing
-- mid-session and resuming exactly where you left off work with no extra
-- rows or inference needed.
create table if not exists public.bible_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bible_study_sessions(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  question_text text not null,
  answer_text text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (session_id, position)
);

alter table public.bible_session_questions enable row level security;
drop policy if exists "Select own bible_session_questions" on public.bible_session_questions;
create policy "Select own bible_session_questions" on public.bible_session_questions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_session_questions" on public.bible_session_questions;
create policy "Insert own bible_session_questions" on public.bible_session_questions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_session_questions" on public.bible_session_questions;
create policy "Update own bible_session_questions" on public.bible_session_questions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_session_questions" on public.bible_session_questions;
create policy "Delete own bible_session_questions" on public.bible_session_questions for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_session_questions from anon;
grant select, insert, update, delete on public.bible_session_questions to authenticated;

create index if not exists bible_session_questions_user_id_idx on public.bible_session_questions(user_id);
create index if not exists bible_session_questions_session_id_idx on public.bible_session_questions(session_id);

-- -------------------------------------------------------- bible_passage_notes ----

-- Dated log rows keyed to a passage, modelled on public.interactions (the
-- People module's actual "notes over time" precedent — person_notes, cited
-- in the original brief, doesn't exist in this codebase).
create table if not exists public.bible_passage_notes (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.bible_passages(id) on delete cascade,
  -- Optional provenance: which session (if any) produced this note. Set
  -- null, not cascaded, when the session is deleted — the note remains
  -- valuable independent of the study it came from. Also legitimately null
  -- from the start for a note jotted outside any active study.
  session_id uuid references public.bible_study_sessions(id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table public.bible_passage_notes enable row level security;
drop policy if exists "Select own bible_passage_notes" on public.bible_passage_notes;
create policy "Select own bible_passage_notes" on public.bible_passage_notes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_passage_notes" on public.bible_passage_notes;
create policy "Insert own bible_passage_notes" on public.bible_passage_notes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_passage_notes" on public.bible_passage_notes;
create policy "Update own bible_passage_notes" on public.bible_passage_notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_passage_notes" on public.bible_passage_notes;
create policy "Delete own bible_passage_notes" on public.bible_passage_notes for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_passage_notes from anon;
grant select, insert, update, delete on public.bible_passage_notes to authenticated;

create index if not exists bible_passage_notes_user_id_idx on public.bible_passage_notes(user_id);
-- Powers the resurfacing query: "what did I write last time I studied this
-- passage" — exact passage_id match, newest first.
create index if not exists bible_passage_notes_passage_idx on public.bible_passage_notes(passage_id, created_at desc);
create index if not exists bible_passage_notes_session_id_idx on public.bible_passage_notes(session_id);

-- ------------------------------------------------------------- bible_topics ----

create table if not exists public.bible_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (user_id, slug)
);

alter table public.bible_topics enable row level security;
drop policy if exists "Select own bible_topics" on public.bible_topics;
create policy "Select own bible_topics" on public.bible_topics for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_topics" on public.bible_topics;
create policy "Insert own bible_topics" on public.bible_topics for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_topics" on public.bible_topics;
create policy "Update own bible_topics" on public.bible_topics for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_topics" on public.bible_topics;
create policy "Delete own bible_topics" on public.bible_topics for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_topics from anon;
grant select, insert, update, delete on public.bible_topics to authenticated;

create index if not exists bible_topics_user_id_idx on public.bible_topics(user_id);

-- ---------------------------------------------------------- bible_topic_passages ----

-- "Two taps, zero typing" flow: tap a topic (7 rows), tap shows its
-- passages (5-8 rows, indexed on topic_id) — both are trivial indexed
-- selects, no query-design risk to plan around here.
create table if not exists public.bible_topic_passages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.bible_topics(id) on delete cascade,
  passage_id uuid not null references public.bible_passages(id) on delete cascade,
  reason text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (topic_id, passage_id)
);

alter table public.bible_topic_passages enable row level security;
drop policy if exists "Select own bible_topic_passages" on public.bible_topic_passages;
create policy "Select own bible_topic_passages" on public.bible_topic_passages for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_topic_passages" on public.bible_topic_passages;
create policy "Insert own bible_topic_passages" on public.bible_topic_passages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_topic_passages" on public.bible_topic_passages;
create policy "Update own bible_topic_passages" on public.bible_topic_passages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_topic_passages" on public.bible_topic_passages;
create policy "Delete own bible_topic_passages" on public.bible_topic_passages for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_topic_passages from anon;
grant select, insert, update, delete on public.bible_topic_passages to authenticated;

create index if not exists bible_topic_passages_user_id_idx on public.bible_topic_passages(user_id);
create index if not exists bible_topic_passages_topic_idx on public.bible_topic_passages(topic_id, sort_order);

-- --------------------------------------------------------- bible_daily_verses ----

-- Data source for the (separately planned) home-grid Daily Verse widget.
-- A curated ordered list that cycles by day-of-year, not one row per
-- calendar date — date-stable and curated as specified, for a fraction of
-- the curation effort of hand-picking 365/366 individual dates. Content
-- (which passages, in what order) is a curation task, not a schema task,
-- and is deliberately left empty here.
create table if not exists public.bible_daily_verses (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.bible_passages(id) on delete cascade,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unique (user_id, sort_order)
);

alter table public.bible_daily_verses enable row level security;
drop policy if exists "Select own bible_daily_verses" on public.bible_daily_verses;
create policy "Select own bible_daily_verses" on public.bible_daily_verses for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own bible_daily_verses" on public.bible_daily_verses;
create policy "Insert own bible_daily_verses" on public.bible_daily_verses for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own bible_daily_verses" on public.bible_daily_verses;
create policy "Update own bible_daily_verses" on public.bible_daily_verses for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own bible_daily_verses" on public.bible_daily_verses;
create policy "Delete own bible_daily_verses" on public.bible_daily_verses for delete to authenticated using (auth.uid() = user_id);
revoke all on public.bible_daily_verses from anon;
grant select, insert, update, delete on public.bible_daily_verses to authenticated;

create index if not exists bible_daily_verses_user_id_idx on public.bible_daily_verses(user_id);
