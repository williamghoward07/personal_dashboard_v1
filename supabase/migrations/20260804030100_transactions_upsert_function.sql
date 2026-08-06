-- PostgREST's .upsert() only ever emits `ON CONFLICT (columns) DO UPDATE`
-- with no WHERE clause, but transactions_user_source_external_id_key
-- (20260804030000) is a partial unique index — Postgres only accepts it as
-- an ON CONFLICT arbiter when the WHERE clause is repeated verbatim in the
-- INSERT statement itself, which PostgREST has no way to express. This
-- SECURITY DEFINER wrapper does the ON CONFLICT server-side so sync routes
-- (Starling today) can batch-upsert over PostgREST via .rpc(), mirroring
-- the vault_upsert_secret pattern in 20260804020100.

create or replace function public.upsert_synced_transactions(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.transactions (
    user_id, source, external_id, account_label, merchant_name,
    amount_minor_units, type, category, description, date, raw
  )
  select
    (r->>'user_id')::uuid,
    r->>'source',
    r->>'external_id',
    r->>'account_label',
    r->>'merchant_name',
    (r->>'amount_minor_units')::bigint,
    r->>'type',
    r->>'category',
    r->>'description',
    (r->>'date')::date,
    r->'raw'
  from jsonb_array_elements(rows) as r
  on conflict (user_id, source, external_id) where external_id is not null
  do update set
    account_label = excluded.account_label,
    merchant_name = excluded.merchant_name,
    amount_minor_units = excluded.amount_minor_units,
    type = excluded.type,
    category = excluded.category,
    description = excluded.description,
    date = excluded.date,
    raw = excluded.raw;
end;
$$;

revoke all on function public.upsert_synced_transactions(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_synced_transactions(jsonb) to service_role;
