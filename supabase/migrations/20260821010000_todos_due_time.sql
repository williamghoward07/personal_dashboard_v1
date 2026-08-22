-- Run this in the Supabase SQL editor (Dashboard > SQL Editor).
--
-- Lets a todo carry an optional time alongside its due_date, same 24h
-- HH:mm text shape already used for calendar_event.due_time in the Act
-- flow (lib/search/act.ts) — a todo has no timezone-aware event duration
-- to justify a timestamptz, just a plain time-of-day label.

alter table public.todos
  add column if not exists due_time text;
