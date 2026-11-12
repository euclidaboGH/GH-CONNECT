-- PROPOSAL ONLY — DO NOT APPLY DIRECTLY.
-- This SQL must be reviewed, replayed on a disposable PostgreSQL instance,
-- and integrated into each owning business RPC in the SAME transaction.
-- Calling gh_outbox_enqueue through a separate PostgREST request is NOT atomic.

create table if not exists public.gh_domain_outbox (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid(),
  aggregate_type text not null check (length(btrim(aggregate_type)) between 1 and 80),
  aggregate_id text not null check (length(btrim(aggregate_id)) between 1 and 160),
  event_type text not null check (length(btrim(event_type)) between 1 and 120),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 1 and 200),
  status text not null default 'pending' check (status in ('pending','processing','published','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 12 check (max_attempts between 1 and 50),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  dead_at timestamptz,
  replayed_at timestamptz,
  unique (event_id),
  unique (idempotency_key),
  check ((status = 'processing') = (lease_token is not null and lease_expires_at is not null)),
  check ((status = 'published') = (published_at is not null)),
  check ((status = 'dead') = (dead_at is not null))
);

create index if not exists gh_domain_outbox_pending_idx
  on public.gh_domain_outbox (available_at, id)
  where status = 'pending';
create index if not exists gh_domain_outbox_expired_lease_idx
  on public.gh_domain_outbox (lease_expires_at, id)
  where status = 'processing';
create index if not exists gh_domain_outbox_dead_idx
  on public.gh_domain_outbox (dead_at, id)
  where status = 'dead';

alter table public.gh_domain_outbox enable row level security;
revoke all on public.gh_domain_outbox from public, anon, authenticated;
revoke all on sequence public.gh_domain_outbox_id_seq from public, anon, authenticated;
-- No direct table/sequence grants are required: workers use narrowly scoped RPCs.

-- Called from the business mutation function before its transaction commits.
-- Same transaction means either both the business row and event commit, or neither.
create or replace function public.gh_outbox_enqueue(
  p_aggregate_type text, p_aggregate_id text, p_event_type text,
  p_payload jsonb, p_idempotency_key text, p_max_attempts integer default 12
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event_id uuid; v_existing public.gh_domain_outbox%rowtype;
begin
  if nullif(btrim(p_aggregate_type), '') is null
    or nullif(btrim(p_aggregate_id), '') is null
    or nullif(btrim(p_event_type), '') is null
    or nullif(btrim(p_idempotency_key), '') is null
    or jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
    or coalesce(p_max_attempts, 0) not between 1 and 50 then
    raise exception 'OUTBOX_INVALID_INPUT' using errcode = '22023';
  end if;
  insert into public.gh_domain_outbox
    (aggregate_type, aggregate_id, event_type, payload, idempotency_key, max_attempts)
  values
    (p_aggregate_type, p_aggregate_id, p_event_type, coalesce(p_payload, '{}'::jsonb), p_idempotency_key, p_max_attempts)
  on conflict (idempotency_key) do nothing
  returning event_id into v_event_id;
  if v_event_id is null then
    select * into v_existing from public.gh_domain_outbox where idempotency_key = p_idempotency_key;
    if not found then raise exception 'OUTBOX_IDEMPOTENCY_RACE' using errcode='40001'; end if;
    if v_existing.aggregate_type is distinct from p_aggregate_type
      or v_existing.aggregate_id is distinct from p_aggregate_id
      or v_existing.event_type is distinct from p_event_type
      or v_existing.payload is distinct from coalesce(p_payload, '{}'::jsonb)
      or v_existing.max_attempts is distinct from p_max_attempts then
      raise exception 'OUTBOX_IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    v_event_id := v_existing.event_id;
  end if;
  return v_event_id;
end $$;

-- Atomically leases a batch. SKIP LOCKED permits horizontally scaled workers.
create or replace function public.gh_outbox_claim(
  p_limit integer default 25, p_lease_seconds integer default 60
) returns setof public.gh_domain_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 10 and 900 then
    raise exception 'OUTBOX_INVALID_CLAIM' using errcode = '22023';
  end if;
  update public.gh_domain_outbox set status='dead', dead_at=now(), lease_token=null, lease_expires_at=null,
    last_error_code=coalesce(last_error_code,'MAX_ATTEMPTS_EXCEEDED')
  where attempts >= max_attempts and status in ('pending','processing')
    and (status='pending' or lease_expires_at <= now());
  return query
  with candidates as (
    select id from public.gh_domain_outbox
    where (status='pending' and available_at <= now())
       or (status='processing' and lease_expires_at <= now())
    order by available_at, id
    for update skip locked
    limit p_limit
  )
  update public.gh_domain_outbox o
     set status='processing', attempts=o.attempts+1,
         lease_token=gen_random_uuid(), lease_expires_at=now() + make_interval(secs => p_lease_seconds)
    from candidates c where o.id=c.id
  returning o.*;
end $$;

create or replace function public.gh_outbox_heartbeat(p_event_id uuid, p_lease_token uuid, p_lease_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_lease_seconds not between 10 and 900 then raise exception 'OUTBOX_INVALID_LEASE' using errcode='22023'; end if;
  update public.gh_domain_outbox set lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
  where event_id=p_event_id and status='processing' and lease_token=p_lease_token and lease_expires_at>now();
  return found;
end $$;

create or replace function public.gh_outbox_ack(p_event_id uuid, p_lease_token uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.gh_domain_outbox set status='published', published_at=now(),
    lease_token=null, lease_expires_at=null, last_error_code=null
  where event_id=p_event_id and status='processing' and lease_token=p_lease_token
    and lease_expires_at > now();
  return found;
end $$;

create or replace function public.gh_outbox_fail(p_event_id uuid, p_lease_token uuid, p_error_code text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.gh_domain_outbox%rowtype; v_status text;
begin
  select * into v from public.gh_domain_outbox
  where event_id=p_event_id and status='processing' and lease_token=p_lease_token
    and lease_expires_at > now() for update;
  if not found then return 'LEASE_LOST'; end if;
  if v.attempts >= v.max_attempts then
    update public.gh_domain_outbox set status='dead', dead_at=now(), lease_token=null,
      lease_expires_at=null, last_error_code=left(coalesce(nullif(p_error_code,''),'DELIVERY_FAILED'),80)
    where id=v.id;
    return 'DEAD';
  end if;
  update public.gh_domain_outbox set status='pending', lease_token=null, lease_expires_at=null,
    available_at=now() + make_interval(secs => least(3600, 5 * (2 ^ least(v.attempts, 9))::integer)),
    last_error_code=left(coalesce(nullif(p_error_code,''),'DELIVERY_FAILED'),80)
  where id=v.id;
  return 'RETRY';
end $$;

create table if not exists public.gh_domain_outbox_replay_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  operator_id text not null check (length(btrim(operator_id)) between 1 and 128),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  replayed_at timestamptz not null default now()
);
alter table public.gh_domain_outbox_replay_audit enable row level security;
revoke all on public.gh_domain_outbox_replay_audit from public, anon, authenticated, service_role;

-- Operator replay preserves event_id and idempotency_key; downstream consumers MUST dedupe.
-- The calling operator API must derive p_operator_id from its authenticated server session.
create or replace function public.gh_outbox_replay(p_event_id uuid, p_operator_id text, p_reason text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if nullif(btrim(p_operator_id),'') is null or length(btrim(p_operator_id))>128
    or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then
    raise exception 'OUTBOX_INVALID_REPLAY_AUDIT' using errcode='22023';
  end if;
  update public.gh_domain_outbox set status='pending', attempts=0, available_at=now(),
    lease_token=null, lease_expires_at=null, dead_at=null, published_at=null,
    last_error_code=null, replayed_at=now()
  where event_id=p_event_id and status='dead';
  if not found then return false; end if;
  insert into public.gh_domain_outbox_replay_audit(event_id,operator_id,reason)
  values(p_event_id,btrim(p_operator_id),btrim(p_reason));
  return true;
end $$;

revoke all on function public.gh_outbox_enqueue(text,text,text,jsonb,text,integer) from public, anon, authenticated;
revoke all on function public.gh_outbox_claim(integer,integer) from public, anon, authenticated;
revoke all on function public.gh_outbox_heartbeat(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.gh_outbox_ack(uuid,uuid) from public, anon, authenticated;
revoke all on function public.gh_outbox_fail(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.gh_outbox_replay(uuid,text,text) from public, anon, authenticated;
grant execute on function public.gh_outbox_claim(integer,integer) to service_role;
grant execute on function public.gh_outbox_heartbeat(uuid,uuid,integer) to service_role;
grant execute on function public.gh_outbox_ack(uuid,uuid) to service_role;
grant execute on function public.gh_outbox_fail(uuid,uuid,text) to service_role;
grant execute on function public.gh_outbox_replay(uuid,text,text) to service_role;
-- gh_outbox_enqueue is intentionally callable by owner-executed SECURITY DEFINER business RPCs;
-- it is not granted to API roles as a standalone endpoint.
