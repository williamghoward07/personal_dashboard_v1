-- Focus Timer, phase 1: server-side timer sessions (docs/specs/focus-timer-spec.md).
--
-- Re-runnable: `if not exists`, `drop policy if exists`, `create or
-- replace`. Requires 20261009020000_workspace_readings_and_time.sql
-- (time_entries reads workspace_time_logs) — the guard below stops early
-- if it hasn't been applied.
--
-- Design notes:
--   * Route B: a new table plus a view, so workspace_time_logs (the manual
--     "add time" log) and its UI are untouched. time_entries unions the two
--     with a `source` column ('timer' / 'manual').
--   * A running timer is a row with ended_at null. Pause/resume are
--     segments: pausing ends the row with ended_reason 'paused', resuming
--     inserts a new row with the same session_group_id. A session's
--     duration is the sum of its segments.
--   * State is derived, never flagged: the user's latest segment (by
--     created_at) decides it. ended_at null -> running; ended_reason 'paused' -> paused;
--     anything else -> no open session. Only the last segment of a session
--     carries the final reason (earlier 'paused' rows are never rewritten),
--     so a session is discarded when any of its segments is 'discarded'.
--   * Nothing hard-deletes: there is no delete policy or grant. Discard is
--     ended_reason = 'discarded', excluded from time_entries.
--   * Every timestamp comes from now(). UTC is stored; day bucketing is
--     Europe/London at query time (time_breakdown), so a session crossing
--     midnight or the BST -> GMT change is split in the query.
--   * 12h stop is per segment: ended_at = started_at + 12h, ended_reason
--     'auto_stopped_12h'. Applied on read (timer_active, and before every
--     write) and by a daily cron (timer_auto_stop_all). Until it's applied,
--     every read caps a running segment at started_at + 12h.
--   * RPCs are security invoker. Browser callers are identified by
--     auth.uid() (p_user_id is ignored for them); the service-role client
--     (bearer-token callers, see lib/timer/auth.ts) passes p_user_id.
--     Writes take a per-user advisory lock so two devices can't race into
--     two open sessions. Errors are `raise exception '<key>'`, mapped to
--     HTTP statuses in lib/timer/errors.ts.

do $$
begin
  if to_regclass('public.workspace_time_logs') is null then
    raise exception 'Apply 20261009020000_workspace_readings_and_time.sql first: time_entries reads workspace_time_logs.';
  end if;
end $$;

-- --------------------------------------------------------- time_sessions --

create table if not exists public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  session_group_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  client text not null default 'web'
    constraint time_sessions_client_check check (client in ('web','mac','shortcut','phone')),
  ended_reason text
    constraint time_sessions_ended_reason_check
    check (ended_reason in ('stopped','paused','trimmed','auto_stopped_12h','discarded')),
  note text,
  checkin_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  constraint time_sessions_ended_check check ((ended_at is null) = (ended_reason is null)),
  constraint time_sessions_order_check check (ended_at is null or ended_at >= started_at)
);

alter table public.time_sessions enable row level security;

drop policy if exists "Select own time_sessions" on public.time_sessions;
drop policy if exists "Insert own time_sessions" on public.time_sessions;
drop policy if exists "Update own time_sessions" on public.time_sessions;

create policy "Select own time_sessions" on public.time_sessions
  for select to authenticated using (auth.uid() = user_id);
create policy "Insert own time_sessions" on public.time_sessions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid())
  );
create policy "Update own time_sessions" on public.time_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid())
  );

revoke all on public.time_sessions from anon;
revoke delete, truncate on public.time_sessions from authenticated;
grant select, insert, update on public.time_sessions to authenticated;

-- One running segment per user. "One open session" (running or paused)
-- is enforced by the RPCs under the advisory lock.
create unique index if not exists time_sessions_one_running_idx
  on public.time_sessions(user_id) where ended_at is null;
create index if not exists time_sessions_user_started_idx on public.time_sessions(user_id, started_at desc);
create index if not exists time_sessions_group_idx on public.time_sessions(session_group_id);
create index if not exists time_sessions_workspace_started_idx on public.time_sessions(workspace_id, started_at);

-- ---------------------------------------------------------- time_entries --

-- Timer segments and manual entries side by side. Timer rows: started_at /
-- ended_at (a running segment ends at now(), capped at 12h), day null.
-- Manual rows: day + seconds, no timestamps.
create or replace view public.time_entries with (security_invoker = true) as
  select
    'timer'::text as source,
    s.id,
    s.user_id,
    s.workspace_id,
    s.session_group_id,
    s.label,
    s.note,
    s.started_at,
    coalesce(s.ended_at, least(now(), s.started_at + interval '12 hours')) as ended_at,
    s.ended_at is null as is_running,
    null::date as day,
    floor(extract(epoch from
      coalesce(s.ended_at, least(now(), s.started_at + interval '12 hours')) - s.started_at
    ))::bigint as seconds
  from public.time_sessions s
  where not exists (
    select 1 from public.time_sessions d
    where d.session_group_id = s.session_group_id and d.ended_reason = 'discarded'
  )
  union all
  select
    'manual'::text,
    m.id,
    m.user_id,
    m.workspace_id,
    null::uuid,
    null::text,
    m.note,
    null::timestamptz,
    null::timestamptz,
    false,
    m.day,
    (m.minutes * 60)::bigint
  from public.workspace_time_logs m;

revoke all on public.time_entries from anon;
grant select on public.time_entries to authenticated;

-- --------------------------------------------------------------- helpers --

-- The caller's user id: auth.uid() for a browser session, else p_user_id
-- (service-role callers). p_lock serialises this user's timer writes.
create or replace function public.timer_uid(p_user_id uuid default null, p_lock boolean default false)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(auth.uid(), p_user_id);
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  if p_lock then
    perform pg_advisory_xact_lock(hashtext('time_sessions:' || v_uid::text));
  end if;
  return v_uid;
end $$;

-- The user's open segment, else null: the running row if there is one (the
-- unique index allows at most one), else the most recently created segment
-- if it ended with 'paused'. Ordered by created_at, not started_at, so a
-- backdated or trimmed row can't hide an open one.
create or replace function public.timer_open_segment(p_uid uuid)
returns public.time_sessions
language sql
stable
security invoker
set search_path = ''
as $$
  select l.*
  from (
    select s.* from public.time_sessions s
    where s.user_id = p_uid
    order by (s.ended_at is null) desc, s.created_at desc, s.started_at desc
    limit 1
  ) l
  where l.ended_at is null or l.ended_reason = 'paused'
$$;

-- One session (all segments of a group) as the JSON every endpoint returns.
-- running_seconds sums the segments (a running one up to now()).
-- checkin_due: running, and a 4h mark has been crossed since the last
-- acknowledgement — acknowledging at 4h37m means no prompt until 8h.
create or replace function public.timer_session_json(p_group_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with seg as (
    select s.*, coalesce(s.ended_at, least(now(), s.started_at + interval '12 hours')) as eff_end
    from public.time_sessions s
    where s.session_group_id = p_group_id
  ),
  ack as (
    select max(checkin_acknowledged_at) as at from seg
  ),
  totals as (
    select
      coalesce(sum(extract(epoch from seg.eff_end - seg.started_at)), 0) as running,
      coalesce(sum(
        case when ack.at is null then 0
        else extract(epoch from greatest(least(seg.eff_end, ack.at) - seg.started_at, interval '0'))
        end
      ), 0) as running_at_ack
    from seg cross join ack
  ),
  last as (
    select * from seg order by (ended_at is null) desc, created_at desc, started_at desc limit 1
  )
  select jsonb_build_object(
    'session_group_id', l.session_group_id,
    'workspace_id', l.workspace_id,
    'workspace_title', w.title,
    'label', l.label,
    'note', l.note,
    'state', case
      when l.ended_reason = 'discarded' then 'discarded'
      when l.ended_at is null then 'running'
      when l.ended_reason = 'paused' then 'paused'
      else 'stopped'
    end,
    'ended_reason', l.ended_reason,
    'started_at', (select min(started_at) from seg),
    'ended_at', case when l.ended_reason is distinct from 'paused' then l.ended_at end,
    'running_seconds', floor(t.running)::bigint,
    'checkin_due', l.ended_at is null and floor(t.running / 14400) > floor(t.running_at_ack / 14400),
    'checkin_acknowledged_at', a.at,
    'segments', (
      select jsonb_agg(jsonb_build_object(
        'id', seg.id,
        'started_at', seg.started_at,
        'ended_at', seg.ended_at,
        'ended_reason', seg.ended_reason,
        'client', seg.client,
        'seconds', floor(extract(epoch from seg.eff_end - seg.started_at))::bigint
      ) order by seg.started_at, seg.created_at)
      from seg
    )
  )
  from last l
  left join public.workspaces w on w.id = l.workspace_id
  cross join totals t
  cross join ack a
$$;

-- ------------------------------------------------------------ 12h stop --

create or replace function public.timer_auto_stop(p_user_id uuid default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_count int;
begin
  update public.time_sessions
    set ended_at = started_at + interval '12 hours', ended_reason = 'auto_stopped_12h'
  where user_id = v_uid
    and ended_at is null
    and started_at <= now() - interval '12 hours';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Every user — the daily cron (/api/cron/timer-auto-stop). service_role only.
create or replace function public.timer_auto_stop_all()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.time_sessions
    set ended_at = started_at + interval '12 hours', ended_reason = 'auto_stopped_12h'
  where ended_at is null
    and started_at <= now() - interval '12 hours';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ------------------------------------------------------------- breakdown --

-- { total, timer, manual } seconds for Europe/London days p_from..p_to
-- inclusive, optionally one workspace. Timer segments are clipped to the
-- window, so a session crossing midnight counts only its part inside.
create or replace function public.time_breakdown(
  p_from date,
  p_to date,
  p_workspace_id uuid default null,
  p_user_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id);
  v_start timestamptz;
  v_end timestamptz;
  v_timer bigint;
  v_manual bigint;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_range';
  end if;
  v_start := p_from::timestamp at time zone 'Europe/London';
  v_end := (p_to + 1)::timestamp at time zone 'Europe/London';

  select floor(coalesce(sum(extract(epoch from least(e.ended_at, v_end) - greatest(e.started_at, v_start))), 0))::bigint
    into v_timer
  from public.time_entries e
  where e.source = 'timer'
    and e.user_id = v_uid
    and (p_workspace_id is null or e.workspace_id = p_workspace_id)
    and e.started_at < v_end
    and e.ended_at > v_start;

  select coalesce(sum(e.seconds), 0)::bigint
    into v_manual
  from public.time_entries e
  where e.source = 'manual'
    and e.user_id = v_uid
    and (p_workspace_id is null or e.workspace_id = p_workspace_id)
    and e.day between p_from and p_to;

  return jsonb_build_object('total', v_timer + v_manual, 'timer', v_timer, 'manual', v_manual);
end $$;

-- ------------------------------------------------------------- endpoints --

-- GET /api/timer/active: the open session (12h stop applied first) and
-- today's (London) total for its workspace.
create or replace function public.timer_active(p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
  v_today date := (now() at time zone 'Europe/London')::date;
begin
  perform public.timer_auto_stop(v_uid);
  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is null then
    return jsonb_build_object('session', null, 'today', null);
  end if;
  return jsonb_build_object(
    'session', public.timer_session_json(v_seg.session_group_id),
    'today', public.time_breakdown(v_today, v_today, v_seg.workspace_id, v_uid)
  );
end $$;

-- An open session is returned as { conflict: true, session } (409) so the
-- client can offer switch; nothing is started.
create or replace function public.timer_start(
  p_workspace_id uuid,
  p_label text default null,
  p_client text default 'web',
  p_user_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
  v_group uuid := gen_random_uuid();
begin
  perform public.timer_auto_stop(v_uid);
  if not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.user_id = v_uid) then
    raise exception 'workspace_not_found';
  end if;

  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is not null then
    return jsonb_build_object('conflict', true, 'session', public.timer_session_json(v_seg.session_group_id));
  end if;

  insert into public.time_sessions (session_group_id, workspace_id, label, client, started_at, user_id)
  values (v_group, p_workspace_id, p_label, p_client, now(), v_uid);

  return jsonb_build_object('conflict', false, 'session', public.timer_session_json(v_group));
end $$;

create or replace function public.timer_pause(p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
begin
  perform public.timer_auto_stop(v_uid);
  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is null then
    raise exception 'no_open_session';
  end if;
  if v_seg.ended_at is not null then
    raise exception 'not_running';
  end if;

  update public.time_sessions set ended_at = now(), ended_reason = 'paused' where id = v_seg.id;
  return public.timer_session_json(v_seg.session_group_id);
end $$;

create or replace function public.timer_resume(p_client text default 'web', p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
begin
  perform public.timer_auto_stop(v_uid);
  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is null then
    raise exception 'no_open_session';
  end if;
  if v_seg.ended_at is null then
    raise exception 'not_paused';
  end if;

  insert into public.time_sessions (session_group_id, workspace_id, label, client, started_at, user_id)
  values (v_seg.session_group_id, v_seg.workspace_id, v_seg.label, p_client, now(), v_uid);
  return public.timer_session_json(v_seg.session_group_id);
end $$;

-- p_trim_to ("I actually stopped at 14:30") ends the last segment earlier.
-- It must fall inside that segment: not before its start, not after now()
-- (or after the pause, for a paused session).
create or replace function public.timer_stop(
  p_trim_to timestamptz default null,
  p_note text default null,
  p_user_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
begin
  perform public.timer_auto_stop(v_uid);
  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is null then
    raise exception 'no_open_session';
  end if;
  if p_trim_to is not null and (
    p_trim_to < v_seg.started_at
    or p_trim_to > now()
    or (v_seg.ended_at is not null and p_trim_to > v_seg.ended_at)
  ) then
    raise exception 'invalid_trim';
  end if;

  update public.time_sessions
    set ended_at = coalesce(p_trim_to, ended_at, now()),
        ended_reason = case when p_trim_to is not null then 'trimmed' else 'stopped' end,
        note = coalesce(p_note, note)
  where id = v_seg.id;
  return public.timer_session_json(v_seg.session_group_id);
end $$;

-- Stop the open session (if any) and start a new one, in one transaction.
create or replace function public.timer_switch(
  p_workspace_id uuid,
  p_label text default null,
  p_client text default 'web',
  p_user_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
  v_stopped jsonb;
  v_group uuid := gen_random_uuid();
begin
  perform public.timer_auto_stop(v_uid);
  if not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.user_id = v_uid) then
    raise exception 'workspace_not_found';
  end if;

  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is not null then
    update public.time_sessions
      set ended_at = coalesce(ended_at, now()), ended_reason = 'stopped'
    where id = v_seg.id;
    v_stopped := public.timer_session_json(v_seg.session_group_id);
  end if;

  insert into public.time_sessions (session_group_id, workspace_id, label, client, started_at, user_id)
  values (v_group, p_workspace_id, p_label, p_client, now(), v_uid);

  return jsonb_build_object('stopped', v_stopped, 'session', public.timer_session_json(v_group));
end $$;

-- Soft discard: the last segment ends (now, or where it paused) with
-- 'discarded', which drops the whole session from time_entries.
create or replace function public.timer_discard(p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
begin
  perform public.timer_auto_stop(v_uid);
  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is null then
    raise exception 'no_open_session';
  end if;

  update public.time_sessions
    set ended_at = coalesce(ended_at, now()), ended_reason = 'discarded'
  where id = v_seg.id;
  return public.timer_session_json(v_seg.session_group_id);
end $$;

-- "Keep going" on the 4h check-in.
create or replace function public.timer_checkin(p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id, true);
  v_seg public.time_sessions;
begin
  perform public.timer_auto_stop(v_uid);
  v_seg := public.timer_open_segment(v_uid);
  if v_seg.id is null then
    raise exception 'no_open_session';
  end if;

  update public.time_sessions set checkin_acknowledged_at = now() where id = v_seg.id;
  return public.timer_session_json(v_seg.session_group_id);
end $$;

-- Distinct workspaces by most recent timer start, for quick pickers.
-- Archived workspaces and discarded sessions are left out.
create or replace function public.timer_recent_workspaces(p_limit int default 8, p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.timer_uid(p_user_id);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'workspace_id', r.workspace_id,
      'title', r.title,
      'last_started_at', r.last_started_at
    ) order by r.last_started_at desc)
    from (
      select e.workspace_id, w.title, max(e.started_at) as last_started_at
      from public.time_entries e
      join public.workspaces w on w.id = e.workspace_id
      where e.source = 'timer' and e.user_id = v_uid and w.archived_at is null
      group by e.workspace_id, w.title
      order by last_started_at desc
      limit greatest(1, least(coalesce(p_limit, 8), 50))
    ) r
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------ privileges --

revoke execute on function public.timer_uid(uuid, boolean) from public, anon;
revoke execute on function public.timer_open_segment(uuid) from public, anon;
revoke execute on function public.timer_session_json(uuid) from public, anon;
revoke execute on function public.timer_auto_stop(uuid) from public, anon;
revoke execute on function public.timer_auto_stop_all() from public, anon, authenticated;
revoke execute on function public.time_breakdown(date, date, uuid, uuid) from public, anon;
revoke execute on function public.timer_active(uuid) from public, anon;
revoke execute on function public.timer_start(uuid, text, text, uuid) from public, anon;
revoke execute on function public.timer_pause(uuid) from public, anon;
revoke execute on function public.timer_resume(text, uuid) from public, anon;
revoke execute on function public.timer_stop(timestamptz, text, uuid) from public, anon;
revoke execute on function public.timer_switch(uuid, text, text, uuid) from public, anon;
revoke execute on function public.timer_discard(uuid) from public, anon;
revoke execute on function public.timer_checkin(uuid) from public, anon;
revoke execute on function public.timer_recent_workspaces(int, uuid) from public, anon;

grant execute on function public.timer_uid(uuid, boolean) to authenticated, service_role;
grant execute on function public.timer_open_segment(uuid) to authenticated, service_role;
grant execute on function public.timer_session_json(uuid) to authenticated, service_role;
grant execute on function public.timer_auto_stop(uuid) to authenticated, service_role;
grant execute on function public.timer_auto_stop_all() to service_role;
grant execute on function public.time_breakdown(date, date, uuid, uuid) to authenticated, service_role;
grant execute on function public.timer_active(uuid) to authenticated, service_role;
grant execute on function public.timer_start(uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.timer_pause(uuid) to authenticated, service_role;
grant execute on function public.timer_resume(text, uuid) to authenticated, service_role;
grant execute on function public.timer_stop(timestamptz, text, uuid) to authenticated, service_role;
grant execute on function public.timer_switch(uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.timer_discard(uuid) to authenticated, service_role;
grant execute on function public.timer_checkin(uuid) to authenticated, service_role;
grant execute on function public.timer_recent_workspaces(int, uuid) to authenticated, service_role;
