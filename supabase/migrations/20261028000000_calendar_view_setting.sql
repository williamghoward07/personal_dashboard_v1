-- user_settings.calendar_view: the Calendar page's last-used view
-- (month | week | day | routines), so it reopens where you left it.
-- Re-runnable: `add column if not exists`.
alter table public.user_settings
  add column if not exists calendar_view text not null default 'week';
