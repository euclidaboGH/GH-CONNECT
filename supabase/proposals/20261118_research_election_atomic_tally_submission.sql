-- REVIEW-REQUIRED proposal. Depends on:
-- 20261116182000_gh_research_intelligence_platform_foundation.sql
-- Do not apply until the held Research Intelligence foundation migration has been
-- rehearsed on disposable PostgreSQL and the exact Testnet migration history is reconciled.
BEGIN;

CREATE OR REPLACE FUNCTION public.gh_research_election_tally_submit(
  p_project_id uuid,
  p_contest_id uuid,
  p_actor_user_id text,
  p_geo_unit_id uuid,
  p_polling_unit_code text,
  p_registered_voters integer,
  p_accredited_voters integer,
  p_total_ballots integer,
  p_valid_votes integer,
  p_rejected_ballots integer,
  p_candidate_votes jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_contest public.gh_research_election_contests%ROWTYPE;
  v_existing public.gh_research_tallies%ROWTYPE;
  v_candidate_total bigint;
  v_candidate_count integer;
  v_inserted_id uuid;
  v_existing_votes jsonb;
  v_requested_votes jsonb;
BEGIN
  IF p_project_id IS NULL OR p_contest_id IS NULL OR p_geo_unit_id IS NULL
     OR p_actor_user_id IS NULL OR char_length(p_actor_user_id) NOT BETWEEN 1 AND 256
     OR p_polling_unit_code IS NULL OR char_length(p_polling_unit_code) NOT BETWEEN 1 AND 120
     OR p_polling_unit_code ~ '[[:cntrl:]]'
     OR p_valid_votes IS NULL OR p_valid_votes < 0
     OR p_rejected_ballots IS NULL OR p_rejected_ballots < 0
     OR (p_registered_voters IS NOT NULL AND p_registered_voters < 0)
     OR (p_accredited_voters IS NOT NULL AND p_accredited_voters < 0)
     OR (p_total_ballots IS NOT NULL AND p_total_ballots < 0)
     OR (p_registered_voters IS NOT NULL AND p_accredited_voters IS NOT NULL AND p_accredited_voters > p_registered_voters)
     OR (p_total_ballots IS NOT NULL AND p_valid_votes::bigint + p_rejected_ballots::bigint <> p_total_ballots)
     OR (p_total_ballots IS NOT NULL AND p_accredited_voters IS NOT NULL AND p_total_ballots > p_accredited_voters)
     OR p_candidate_votes IS NULL
     OR CASE WHEN jsonb_typeof(p_candidate_votes)='array' THEN jsonb_array_length(p_candidate_votes) NOT BETWEEN 1 AND 100 ELSE true END THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_TALLY');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_candidate_votes) e(value)
    WHERE CASE WHEN jsonb_typeof(e.value)='object' THEN (SELECT count(*) FROM jsonb_object_keys(e.value)) <> 2 ELSE true END
       OR NOT (e.value ? 'candidate_id' AND e.value ? 'votes')
       OR jsonb_typeof(e.value->'candidate_id') <> 'string'
       OR (e.value->>'candidate_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR jsonb_typeof(e.value->'votes') <> 'number'
       OR (e.value->>'votes') !~ '^(0|[1-9][0-9]{0,9})$'
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_CANDIDATE_VOTES');
  END IF;

  IF EXISTS (
    SELECT lower(e.value->>'candidate_id')
    FROM jsonb_array_elements(p_candidate_votes) e(value)
    GROUP BY lower(e.value->>'candidate_id') HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','DUPLICATE_CANDIDATE');
  END IF;

  SELECT COALESCE(sum((e.value->>'votes')::bigint),0), count(*)::integer
    INTO v_candidate_total, v_candidate_count
  FROM jsonb_array_elements(p_candidate_votes) e(value);
  IF v_candidate_total <> p_valid_votes OR v_candidate_total > 2147483647 THEN
    RETURN jsonb_build_object('ok',false,'code','CANDIDATE_TOTAL_MISMATCH');
  END IF;
  IF v_candidate_count NOT BETWEEN 1 AND 100 OR v_candidate_count <> (
    SELECT count(*)::integer FROM public.gh_research_candidates c
    WHERE c.contest_id=p_contest_id AND c.is_active
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','CANDIDATE_SET_INCOMPLETE');
  END IF;

  SELECT c.* INTO v_contest
  FROM public.gh_research_election_contests c
  WHERE c.id=p_contest_id AND c.project_id=p_project_id
  FOR UPDATE;
  IF NOT FOUND OR v_contest.status <> 'active' THEN
    RETURN jsonb_build_object('ok',false,'code','CONTEST_NOT_ACTIVE');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_research_members m
    WHERE m.project_id=p_project_id AND m.user_id=p_actor_user_id
      AND m.status='active' AND m.role IN ('owner','editor','field_agent')
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','AGENT_NOT_ACTIVE_PROJECT_MEMBER');
  END IF;

  IF NOT EXISTS (
    WITH RECURSIVE contest_scope(id) AS (
      SELECT v_contest.geo_unit_id WHERE v_contest.geo_unit_id IS NOT NULL
      UNION ALL
      SELECT child.id FROM public.gh_research_geo_units child
      JOIN contest_scope parent ON child.parent_id=parent.id
      WHERE child.country_code=v_contest.country_code AND child.is_active
    )
    SELECT 1 FROM public.gh_research_geo_units g
    WHERE g.id=p_geo_unit_id AND g.country_code=v_contest.country_code AND g.is_active
      AND g.level_key='polling_unit'
      AND g.external_code=p_polling_unit_code
      AND g.source_ref IS NOT NULL AND g.source_version IS NOT NULL
      AND (v_contest.geo_unit_id IS NULL OR g.id IN (SELECT id FROM contest_scope))
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','GEOGRAPHIC_UNIT_NOT_ALLOWED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gh_research_agent_assignments a
    WHERE a.project_id=p_project_id AND a.user_id=p_actor_user_id
      AND a.status IN ('accepted','active')
      AND a.assignment_role IN ('observer','supervisor','coordinator')
      AND (a.geo_unit_id IS NULL OR a.geo_unit_id=p_geo_unit_id)
      AND (a.starts_at IS NULL OR a.starts_at<=now())
      AND (a.ends_at IS NULL OR a.ends_at>now())
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','AGENT_NOT_ASSIGNED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_candidate_votes) e(value)
    LEFT JOIN public.gh_research_candidates c
      ON c.id=(e.value->>'candidate_id')::uuid AND c.contest_id=p_contest_id AND c.is_active
    WHERE c.id IS NULL
  ) THEN
    RETURN jsonb_build_object('ok',false,'code','CANDIDATE_NOT_ACTIVE_IN_CONTEST');
  END IF;

  -- Serialize retries for the same contest/polling-unit/agent identity.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contest_id::text || ':' || p_polling_unit_code || ':' || p_actor_user_id,0));
  SELECT * INTO v_existing FROM public.gh_research_tallies
  WHERE contest_id=p_contest_id AND polling_unit_code=p_polling_unit_code AND agent_user_id=p_actor_user_id;

  SELECT jsonb_agg(jsonb_build_object('candidate_id',lower(e.value->>'candidate_id'),'votes',(e.value->>'votes')::integer) ORDER BY lower(e.value->>'candidate_id'))
    INTO v_requested_votes FROM jsonb_array_elements(p_candidate_votes) e(value);
  IF v_existing.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('candidate_id',lower(cv.candidate_id::text),'votes',cv.votes) ORDER BY lower(cv.candidate_id::text)),'[]'::jsonb)
      INTO v_existing_votes FROM public.gh_research_tally_candidate_votes cv WHERE cv.tally_id=v_existing.id;
    IF v_existing.project_id=p_project_id AND v_existing.geo_unit_id=p_geo_unit_id
       AND v_existing.registered_voters IS NOT DISTINCT FROM p_registered_voters
       AND v_existing.accredited_voters IS NOT DISTINCT FROM p_accredited_voters
       AND v_existing.total_ballots IS NOT DISTINCT FROM p_total_ballots
       AND v_existing.valid_votes=p_valid_votes AND v_existing.rejected_ballots=p_rejected_ballots
       AND v_existing_votes=v_requested_votes THEN
      RETURN jsonb_build_object('ok',true,'tallyId',v_existing.id,'idempotent',true,'reconciliationStatus',v_existing.reconciliation_status);
    END IF;
    RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
  END IF;

  INSERT INTO public.gh_research_tallies(
    project_id,contest_id,geo_unit_id,polling_unit_code,agent_user_id,
    registered_voters,accredited_voters,total_ballots,valid_votes,rejected_ballots,reconciliation_status
  ) VALUES (
    p_project_id,p_contest_id,p_geo_unit_id,p_polling_unit_code,p_actor_user_id,
    p_registered_voters,p_accredited_voters,p_total_ballots,p_valid_votes,p_rejected_ballots,'pending'
  ) RETURNING id INTO v_inserted_id;

  INSERT INTO public.gh_research_tally_candidate_votes(tally_id,contest_id,candidate_id,votes)
  SELECT v_inserted_id,p_contest_id,(e.value->>'candidate_id')::uuid,(e.value->>'votes')::integer
  FROM jsonb_array_elements(p_candidate_votes) e(value);

  INSERT INTO public.gh_research_audit_events(project_id,actor_user_id,action,target_type,target_id,details)
  VALUES (p_project_id,p_actor_user_id,'election_tally_submitted','election_tally',v_inserted_id::text,
    jsonb_build_object('contest_id',p_contest_id,'geo_unit_id',p_geo_unit_id,'polling_unit_code',p_polling_unit_code,'candidate_count',v_candidate_count));

  RETURN jsonb_build_object('ok',true,'tallyId',v_inserted_id,'idempotent',false,'reconciliationStatus','pending');
END;
$$;

REVOKE ALL ON FUNCTION public.gh_research_election_tally_submit(uuid,uuid,text,uuid,text,integer,integer,integer,integer,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_research_election_tally_submit(uuid,uuid,text,uuid,text,integer,integer,integer,integer,integer,jsonb) TO service_role;

COMMIT;
