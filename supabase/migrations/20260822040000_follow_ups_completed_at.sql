-- follow_ups.done boolean -> completed_at timestamptz, matching the
-- completed_at convention already used by todos and education_tasks
-- (nullable timestamp rather than a boolean), so the Daily Goals rollup
-- can treat all three the same way and completing a follow-up leaves a
-- timestamp to show in the person's history.
alter table public.follow_ups add column completed_at timestamptz;
update public.follow_ups set completed_at = now() where done = true;
alter table public.follow_ups drop column done;

drop index if exists public.follow_ups_open_idx;
create index follow_ups_open_idx on public.follow_ups (due_date) where completed_at is null;
