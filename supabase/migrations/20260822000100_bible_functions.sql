-- Two functions supporting the Bible study module's write paths.
--
-- Both are security invoker (run as the calling user, not elevated) — every
-- insert they perform is a row the caller's own RLS policies already permit
-- them to insert, unlike the Starling/CalDAV sync RPCs which needed
-- security definer specifically to bypass a partial-unique-index upsert
-- limitation. No such limitation applies here.

-- Single place natural-key lookup/insert happens for bible_passages. Called
-- directly by client UI (e.g. adding a note on a passage that doesn't exist
-- yet) and internally by import_bible_study() below.
create or replace function public.get_or_create_bible_passage(
  p_book text,
  p_chapter smallint,
  p_verse_start smallint default null,
  p_verse_end smallint default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_book_order smallint;
begin
  select id into v_id
  from public.bible_passages
  where user_id = auth.uid()
    and book = p_book
    and chapter = p_chapter
    and coalesce(verse_start, -1) = coalesce(p_verse_start, -1)
    and coalesce(verse_end, -1) = coalesce(p_verse_end, -1);

  if v_id is not null then
    return v_id;
  end if;

  -- Mirrors bible_passages' own `book` CHECK constraint exactly (same 66
  -- names). An unmapped p_book falls through to a null v_book_order, which
  -- then fails the insert's not-null/CHECK constraints below — bad input
  -- fails loudly either way.
  v_book_order := case p_book
    when 'Genesis' then 1 when 'Exodus' then 2 when 'Leviticus' then 3
    when 'Numbers' then 4 when 'Deuteronomy' then 5 when 'Joshua' then 6
    when 'Judges' then 7 when 'Ruth' then 8 when '1 Samuel' then 9
    when '2 Samuel' then 10 when '1 Kings' then 11 when '2 Kings' then 12
    when '1 Chronicles' then 13 when '2 Chronicles' then 14 when 'Ezra' then 15
    when 'Nehemiah' then 16 when 'Esther' then 17 when 'Job' then 18
    when 'Psalms' then 19 when 'Proverbs' then 20 when 'Ecclesiastes' then 21
    when 'Song of Solomon' then 22 when 'Isaiah' then 23 when 'Jeremiah' then 24
    when 'Lamentations' then 25 when 'Ezekiel' then 26 when 'Daniel' then 27
    when 'Hosea' then 28 when 'Joel' then 29 when 'Amos' then 30
    when 'Obadiah' then 31 when 'Jonah' then 32 when 'Micah' then 33
    when 'Nahum' then 34 when 'Habakkuk' then 35 when 'Zephaniah' then 36
    when 'Haggai' then 37 when 'Zechariah' then 38 when 'Malachi' then 39
    when 'Matthew' then 40 when 'Mark' then 41 when 'Luke' then 42
    when 'John' then 43 when 'Acts' then 44 when 'Romans' then 45
    when '1 Corinthians' then 46 when '2 Corinthians' then 47 when 'Galatians' then 48
    when 'Ephesians' then 49 when 'Philippians' then 50 when 'Colossians' then 51
    when '1 Thessalonians' then 52 when '2 Thessalonians' then 53 when '1 Timothy' then 54
    when '2 Timothy' then 55 when 'Titus' then 56 when 'Philemon' then 57
    when 'Hebrews' then 58 when 'James' then 59 when '1 Peter' then 60
    when '2 Peter' then 61 when '1 John' then 62 when '2 John' then 63
    when '3 John' then 64 when 'Jude' then 65 when 'Revelation' then 66
  end;

  insert into public.bible_passages (book, book_order, chapter, verse_start, verse_end)
  values (p_book, v_book_order, p_chapter, p_verse_start, p_verse_end)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_bible_passage(text, smallint, smallint, smallint) to authenticated;

-- Atomically creates a study, its ordered sessions (each resolving/creating
-- its passage via the function above), and each session's 2-4 questions,
-- from one JSON payload pasted into the import textarea. A single PL/pgSQL
-- function body is one implicit transaction, so a partial import can never
-- happen. If the caller already has an active study, the first insert
-- raises a unique-violation against bible_studies_one_active_idx — the
-- client catches that and tells the user to complete/archive it first.
--
-- Expected shape of p_study:
-- {
--   "title": "Romans: Grace and Faith",
--   "description": "An 8-week study through Romans",
--   "sessions": [
--     {
--       "title": "Session 1: No Condemnation",
--       "passage": { "book": "Romans", "chapter": 8, "verse_start": 1, "verse_end": 17 },
--       "questions": ["Q1 text", "Q2 text", "Q3 text"]
--     }
--   ]
-- }
create or replace function public.import_bible_study(p_study jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_study_id uuid;
  v_session jsonb;
  v_question_text text;
  v_session_id uuid;
  v_passage_id uuid;
  v_session_number smallint := 0;
  v_question_position smallint;
  v_question_count int;
begin
  insert into public.bible_studies (title, description)
  values (p_study->>'title', p_study->>'description')
  returning id into v_study_id;

  for v_session in select * from jsonb_array_elements(p_study->'sessions')
  loop
    v_session_number := v_session_number + 1;

    v_question_count := jsonb_array_length(v_session->'questions');
    if v_question_count < 2 or v_question_count > 4 then
      raise exception 'Session % has % questions; must be 2-4', v_session_number, v_question_count;
    end if;

    v_passage_id := public.get_or_create_bible_passage(
      v_session->'passage'->>'book',
      (v_session->'passage'->>'chapter')::smallint,
      nullif(v_session->'passage'->>'verse_start', '')::smallint,
      nullif(v_session->'passage'->>'verse_end', '')::smallint
    );

    insert into public.bible_study_sessions (study_id, session_number, passage_id, title)
    values (v_study_id, v_session_number, v_passage_id, v_session->>'title')
    returning id into v_session_id;

    v_question_position := 0;
    for v_question_text in select value from jsonb_array_elements_text(v_session->'questions')
    loop
      v_question_position := v_question_position + 1;
      insert into public.bible_session_questions (session_id, position, question_text)
      values (v_session_id, v_question_position, v_question_text);
    end loop;
  end loop;

  return v_study_id;
end;
$$;

grant execute on function public.import_bible_study(jsonb) to authenticated;
