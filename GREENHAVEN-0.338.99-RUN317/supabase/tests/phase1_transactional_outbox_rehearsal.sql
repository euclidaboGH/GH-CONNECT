-- DISPOSABLE POSTGRESQL ONLY. Requires PHASE-I-TRANSACTIONAL-OUTBOX-DESIGN.sql
-- Run inside a transaction; all test rows are rolled back.
begin;
create temporary table phase1_outbox_business_test(id text primary key) on commit drop;
do $$
declare
  v_id uuid;
  v_dup uuid;
  v_rows integer;
  v_token uuid;
  v_status text;
  v_before integer;
begin
  -- Idempotent enqueue returns the same event identity.
  v_id := public.gh_outbox_enqueue('test','aggregate-1','test.noop','{"n":1}'::jsonb,'phase1-test-idempotency-1',3);
  v_dup := public.gh_outbox_enqueue('test','aggregate-1','test.noop','{"n":1}'::jsonb,'phase1-test-idempotency-1',3);
  if v_id is distinct from v_dup then raise exception 'idempotent enqueue identity mismatch'; end if;
  begin
    perform public.gh_outbox_enqueue('test','aggregate-1','test.noop','{"n":2}'::jsonb,'phase1-test-idempotency-1',3);
    raise exception 'IDEMPOTENCY_CONFLICT_NOT_RAISED';
  exception when unique_violation then
    null; -- same key with a different payload must conflict, never silently reuse.
  end;

  -- Nested exception block is a savepoint: inserted event and domain row both roll back.
  begin
    insert into phase1_outbox_business_test(id) values('business-row-1');
    perform public.gh_outbox_enqueue('test','rollback','test.rollback','{}'::jsonb,'phase1-test-rollback',3);
    raise exception 'ROLLBACK_SENTINEL';
  exception when others then
    if sqlerrm <> 'ROLLBACK_SENTINEL' then raise; end if;
  end;
  if exists(select 1 from public.gh_domain_outbox where idempotency_key='phase1-test-rollback')
    or exists(select 1 from phase1_outbox_business_test where id='business-row-1') then
    raise exception 'business row or outbox event escaped rolled-back transaction';
  end if;
end $$;

-- Lease claim and fenced acknowledgement.
do $$
declare v_id uuid; v_event public.gh_domain_outbox%rowtype; v_ack boolean;
begin
  select event_id into v_id from public.gh_domain_outbox where idempotency_key='phase1-test-idempotency-1';
  select * into v_event from public.gh_outbox_claim(10,30) where event_id=v_id;
  if v_event.event_id is null or v_event.status <> 'processing' then raise exception 'claim failed'; end if;
  v_ack := public.gh_outbox_ack(v_id, gen_random_uuid());
  if v_ack then raise exception 'stale lease token unexpectedly acknowledged'; end if;
  v_ack := public.gh_outbox_ack(v_id, v_event.lease_token);
  if not v_ack then raise exception 'valid lease token did not acknowledge'; end if;
end $$;

-- Max-attempt dead-letter and explicit replay preserve the original event identity.
do $$
declare v_id uuid; v_event public.gh_domain_outbox%rowtype; v_status text; v_replayed boolean;
begin
  v_id := public.gh_outbox_enqueue('test','aggregate-dead','test.dead','{}','phase1-test-dead',1);
  select * into v_event from public.gh_outbox_claim(10,30) where event_id=v_id;
  if v_event.event_id is null then raise exception 'dead-letter claim failed'; end if;
  v_status := public.gh_outbox_fail(v_id,v_event.lease_token,'TEST_FAILURE');
  if v_status <> 'DEAD' then raise exception 'expected DEAD, received %',v_status; end if;
  v_replayed := public.gh_outbox_replay(v_id,'phase1-operator','Disposable rehearsal replay test');
  if not v_replayed then raise exception 'dead-letter replay failed'; end if;
  if not exists(select 1 from public.gh_domain_outbox where event_id=v_id and status='pending' and attempts=0) then
    raise exception 'replay did not reset event safely';
  end if;
end $$;

rollback;
