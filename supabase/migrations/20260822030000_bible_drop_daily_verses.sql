-- Daily Verse feature removed outright — the user decided against it
-- before the module's UI pass. A clean standalone drop: nothing else FKs
-- into bible_daily_verses, and its own FK out to bible_passages disappears
-- with it (bible_passages itself is untouched).

drop table if exists public.bible_daily_verses;
