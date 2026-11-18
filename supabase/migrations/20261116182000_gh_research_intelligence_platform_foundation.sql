-- GreenHaven Research Intelligence Platform foundation.
-- Service/API mediated only: no direct anon/authenticated table access.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS gh_research_responses_id_project_unique ON public.gh_research_responses(id,project_id);

CREATE TABLE IF NOT EXISTS public.gh_research_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  user_id text NOT NULL CHECK (char_length(user_id) BETWEEN 1 AND 256),
  role text NOT NULL CHECK (role IN ('owner','editor','reviewer','field_agent')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','revoked')),
  invited_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,user_id)
);
CREATE INDEX IF NOT EXISTS gh_research_members_user_status_idx ON public.gh_research_members(user_id,status,project_id);

CREATE TABLE IF NOT EXISTS public.gh_research_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  response_id uuid NULL,
  uploaded_by text NOT NULL CHECK (char_length(uploaded_by) BETWEEN 1 AND 256),
  storage_bucket text NOT NULL CHECK (storage_bucket ~ '^[a-z0-9_-]{1,100}$'),
  object_path text NOT NULL CHECK (char_length(object_path) BETWEEN 1 AND 1024),
  media_kind text NOT NULL CHECK (media_kind IN ('image','video','audio','document')),
  mime_type text NOT NULL CHECK (char_length(mime_type) BETWEEN 3 AND 160),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 104857600),
  sha256 text NULL CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','quarantined')),
  captured_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object' AND pg_column_size(metadata)<=8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(storage_bucket,object_path),
  FOREIGN KEY(response_id,project_id) REFERENCES public.gh_research_responses(id,project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS gh_research_evidence_project_idx ON public.gh_research_evidence(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS gh_research_evidence_response_idx ON public.gh_research_evidence(response_id) WHERE response_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gh_research_geo_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  level_key text NOT NULL CHECK (level_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  level_order smallint NOT NULL CHECK (level_order BETWEEN 1 AND 12),
  parent_level_key text NULL,
  is_electoral boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  source_label text NOT NULL DEFAULT 'GreenHaven configurable hierarchy',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code,level_key), UNIQUE(country_code,level_order)
);
CREATE TABLE IF NOT EXISTS public.gh_research_geo_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  level_key text NOT NULL,
  parent_id uuid NULL,
  external_code text NULL CHECK (external_code IS NULL OR char_length(external_code)<=100),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 180),
  normalized_name text NOT NULL CHECK (char_length(normalized_name) BETWEEN 1 AND 180),
  source_ref text NULL CHECK (source_ref IS NULL OR char_length(source_ref)<=500),
  source_version text NULL CHECK (source_version IS NULL OR char_length(source_version)<=80),
  latitude numeric(9,6) NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9,6) NULL CHECK (longitude BETWEEN -180 AND 180),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country_code,level_key,parent_id,normalized_name),
  UNIQUE(id,country_code),
  FOREIGN KEY(country_code,level_key) REFERENCES public.gh_research_geo_levels(country_code,level_key) ON DELETE RESTRICT,
  FOREIGN KEY(parent_id,country_code) REFERENCES public.gh_research_geo_units(id,country_code) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS gh_research_geo_units_identity_idx ON public.gh_research_geo_units(country_code,level_key,COALESCE(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),normalized_name);
CREATE INDEX IF NOT EXISTS gh_research_geo_units_parent_idx ON public.gh_research_geo_units(country_code,parent_id,normalized_name);
CREATE INDEX IF NOT EXISTS gh_research_geo_units_parent_country_fk_idx ON public.gh_research_geo_units(parent_id,country_code) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gh_research_geo_units_code_idx ON public.gh_research_geo_units(country_code,level_key,external_code) WHERE external_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gh_research_election_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  election_type text NOT NULL CHECK (election_type IN ('presidential','gubernatorial','senatorial','house','state_assembly','local','referendum','other')),
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  election_date date NULL,
  geo_unit_id uuid NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed','archived')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,title),
  UNIQUE(id,project_id),
  FOREIGN KEY(geo_unit_id,country_code) REFERENCES public.gh_research_geo_units(id,country_code) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.gh_research_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.gh_research_election_contests(id) ON DELETE CASCADE,
  candidate_name text NOT NULL CHECK (char_length(candidate_name) BETWEEN 1 AND 180),
  party_name text NOT NULL DEFAULT '' CHECK (char_length(party_name)<=120),
  ballot_order integer NULL CHECK (ballot_order IS NULL OR ballot_order BETWEEN 1 AND 1000),
  external_ref text NULL CHECK (external_ref IS NULL OR char_length(external_ref)<=120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contest_id,candidate_name,party_name)
);
CREATE UNIQUE INDEX IF NOT EXISTS gh_research_candidates_id_contest_unique_idx ON public.gh_research_candidates(id,contest_id);
CREATE TABLE IF NOT EXISTS public.gh_research_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  user_id text NOT NULL CHECK (char_length(user_id) BETWEEN 1 AND 256),
  geo_unit_id uuid NULL REFERENCES public.gh_research_geo_units(id) ON DELETE RESTRICT,
  assignment_role text NOT NULL DEFAULT 'observer' CHECK (assignment_role IN ('observer','supervisor','coordinator','reviewer')),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','accepted','active','completed','revoked')),
  assigned_by text NOT NULL,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS gh_research_assignments_global_unique_idx ON public.gh_research_agent_assignments(project_id,user_id) WHERE geo_unit_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS gh_research_assignments_geo_unique_idx ON public.gh_research_agent_assignments(project_id,user_id,geo_unit_id) WHERE geo_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gh_research_assignments_scope_idx ON public.gh_research_agent_assignments(project_id,geo_unit_id,status);

CREATE TABLE IF NOT EXISTS public.gh_research_tallies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL,
  geo_unit_id uuid NOT NULL REFERENCES public.gh_research_geo_units(id) ON DELETE RESTRICT,
  polling_unit_code text NOT NULL CHECK (char_length(polling_unit_code) BETWEEN 1 AND 120),
  agent_user_id text NOT NULL,
  accredited_voters integer NULL CHECK (accredited_voters IS NULL OR accredited_voters>=0),
  registered_voters integer NULL CHECK (registered_voters IS NULL OR registered_voters>=0),
  total_ballots integer NULL CHECK (total_ballots IS NULL OR total_ballots>=0),
  valid_votes integer NOT NULL DEFAULT 0 CHECK (valid_votes>=0),
  rejected_ballots integer NOT NULL DEFAULT 0 CHECK (rejected_ballots>=0),
  reconciliation_status text NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending','consistent','discrepancy','reviewed','rejected')),
  discrepancy_codes text[] NOT NULL DEFAULT '{}',
  source_response_id uuid NULL REFERENCES public.gh_research_responses(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text NULL,
  reviewed_at timestamptz NULL,
  UNIQUE(contest_id,polling_unit_code,agent_user_id),
  FOREIGN KEY(contest_id,project_id) REFERENCES public.gh_research_election_contests(id,project_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS gh_research_tallies_id_contest_unique_idx ON public.gh_research_tallies(id,contest_id);
CREATE TABLE IF NOT EXISTS public.gh_research_tally_candidate_votes (
  tally_id uuid NOT NULL,
  contest_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  votes integer NOT NULL CHECK (votes>=0),
  PRIMARY KEY(tally_id,candidate_id),
  FOREIGN KEY(tally_id,contest_id) REFERENCES public.gh_research_tallies(id,contest_id) ON DELETE CASCADE,
  FOREIGN KEY(candidate_id,contest_id) REFERENCES public.gh_research_candidates(id,contest_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS gh_research_tallies_contest_geo_idx ON public.gh_research_tallies(contest_id,geo_unit_id,reconciliation_status);

CREATE TABLE IF NOT EXISTS public.gh_research_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  respondent_key_hash text NOT NULL CHECK (respondent_key_hash ~ '^[a-f0-9]{64}$'),
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 100),
  question_order jsonb NOT NULL CHECK (jsonb_typeof(question_order)='array' AND pg_column_size(question_order)<=16384),
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  submitted_at timestamptz NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','timed_out','voided','reviewed')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers)='object' AND pg_column_size(answers)<=65536),
  score numeric(9,2) NULL CHECK (score IS NULL OR score>=0),
  max_score numeric(9,2) NULL CHECK (max_score IS NULL OR max_score>=0),
  result_status text NOT NULL DEFAULT 'withheld' CHECK (result_status IN ('withheld','released','under_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,respondent_key_hash,attempt_number),
  CHECK (deadline_at > started_at),
  CHECK (max_score IS NULL OR score IS NULL OR score<=max_score)
);
CREATE INDEX IF NOT EXISTS gh_research_exam_attempts_project_status_idx ON public.gh_research_exam_attempts(project_id,status,started_at DESC);

CREATE TABLE IF NOT EXISTS public.gh_research_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  description text NOT NULL DEFAULT '' CHECK (char_length(description)<=4000),
  category text NOT NULL DEFAULT 'general' CHECK (char_length(category)<=80),
  objective jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(objective)='object' AND pg_column_size(objective)<=8192),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers','community','invite_only','private')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','open','paused','cancelled','completed','archived')),
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  capacity integer NULL CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 1000000),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS public.gh_research_challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.gh_research_challenges(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','active','completed','withdrawn','removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  PRIMARY KEY(challenge_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.gh_research_challenge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.gh_research_challenges(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  event_key text NOT NULL CHECK (char_length(event_key) BETWEEN 16 AND 100),
  event_type text NOT NULL CHECK (event_type IN ('milestone','progress','evidence_submitted','review_approved','review_rejected')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object' AND pg_column_size(payload)<=8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id,user_id,event_key)
);

CREATE TABLE IF NOT EXISTS public.gh_social_poll_settings (
  poll_id text PRIMARY KEY CHECK (char_length(poll_id) BETWEEN 1 AND 120),
  vote_change_allowed boolean NOT NULL DEFAULT false,
  max_choices smallint NOT NULL DEFAULT 1 CHECK (max_choices BETWEEN 1 AND 20),
  results_visibility text NOT NULL DEFAULT 'after_vote' CHECK (results_visibility IN ('before_vote','after_vote','after_close','owner_only')),
  audience text NOT NULL DEFAULT 'public' CHECK (audience IN ('public','followers','community','invited')),
  opens_at timestamptz NULL,
  closes_at timestamptz NULL,
  allow_write_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at>opens_at)
);

-- Conditional form logic is stored with a bounded, declarative schema. This table
-- records server-side audit events for sensitive changes and reviewer decisions.
CREATE TABLE IF NOT EXISTS public.gh_social_challenges (
  id uuid PRIMARY KEY,
  post_reference text NULL CHECK (post_reference IS NULL OR char_length(post_reference)<=160),
  author_user_id text NOT NULL CHECK (char_length(author_user_id) BETWEEN 1 AND 256),
  title text NOT NULL CHECK (char_length(title) BETWEEN 4 AND 180),
  description text NOT NULL DEFAULT '' CHECK (char_length(description)<=2000),
  metric text NOT NULL CHECK (metric ~ '^[a-z][a-z0-9_]{1,40}$'),
  target integer NOT NULL CHECK (target BETWEEN 1 AND 1000000),
  duration_days smallint NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers','community','invite_only','private')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','scheduled','open','paused','cancelled','completed','archived')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS gh_social_challenges_status_ends_idx ON public.gh_social_challenges(status,ends_at DESC);
CREATE INDEX IF NOT EXISTS gh_social_challenges_author_idx ON public.gh_social_challenges(author_user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.gh_social_challenge_participants (
  challenge_id uuid NOT NULL REFERENCES public.gh_social_challenges(id) ON DELETE CASCADE,
  user_id text NOT NULL CHECK (char_length(user_id) BETWEEN 1 AND 256),
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','active','completed','withdrawn','removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(challenge_id,user_id)
);
CREATE INDEX IF NOT EXISTS gh_social_challenge_participant_user_idx ON public.gh_social_challenge_participants(user_id,status,joined_at DESC);
CREATE TABLE IF NOT EXISTS public.gh_social_challenge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.gh_social_challenges(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  event_key text NOT NULL CHECK (char_length(event_key) BETWEEN 16 AND 100),
  event_type text NOT NULL CHECK (event_type IN ('progress','milestone','evidence_submitted','review_approved','review_rejected')),
  amount integer NOT NULL DEFAULT 0 CHECK (amount BETWEEN 0 AND 1000000),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object' AND pg_column_size(payload)<=8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id,user_id,event_key)
);

CREATE OR REPLACE FUNCTION public.gh_social_challenge_participate(
  p_challenge_id uuid,
  p_user_id text,
  p_action text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE c public.gh_social_challenges%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR char_length(p_user_id) NOT BETWEEN 1 AND 256 OR p_action NOT IN ('join','leave','cancel') THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT');
  END IF;
  SELECT * INTO c FROM public.gh_social_challenges WHERE id=p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','CHALLENGE_NOT_FOUND'); END IF;
  IF p_action='join' THEN
    IF c.visibility <> 'public' AND c.author_user_id <> p_user_id THEN
      RETURN jsonb_build_object('ok',false,'error','CHALLENGE_NOT_OPEN_TO_USER');
    END IF;
    IF c.status <> 'open' OR c.ends_at <= now() THEN
      RETURN jsonb_build_object('ok',false,'error','CHALLENGE_CLOSED');
    END IF;
    INSERT INTO public.gh_social_challenge_participants(challenge_id,user_id,status)
    VALUES (p_challenge_id,p_user_id,'joined')
    ON CONFLICT (challenge_id,user_id) DO UPDATE SET status='joined',updated_at=now()
      WHERE public.gh_social_challenge_participants.status='withdrawn';
    RETURN jsonb_build_object('ok',true,'joined',true);
  ELSIF p_action='leave' THEN
    UPDATE public.gh_social_challenge_participants SET status='withdrawn',updated_at=now()
    WHERE challenge_id=p_challenge_id AND user_id=p_user_id AND status IN ('joined','active');
    RETURN jsonb_build_object('ok',true,'joined',false);
  ELSIF c.author_user_id=p_user_id THEN
    UPDATE public.gh_social_challenges SET status='cancelled',updated_at=now()
    WHERE id=p_challenge_id AND status IN ('draft','scheduled','open','paused');
    RETURN jsonb_build_object('ok',true,'cancelled',true);
  END IF;
  RETURN jsonb_build_object('ok',false,'error','CHALLENGE_NOT_FOUND');
END;
$$;
REVOKE ALL ON FUNCTION public.gh_social_challenge_participate(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_challenge_participate(uuid,text,text) TO service_role;


CREATE TABLE IF NOT EXISTS public.gh_research_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 80),
  target_id text NULL CHECK (target_id IS NULL OR char_length(target_id)<=160),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object' AND pg_column_size(details)<=8192),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gh_research_audit_project_idx ON public.gh_research_audit_events(project_id,created_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gh_research_members','gh_research_evidence','gh_research_geo_levels','gh_research_geo_units',
    'gh_research_election_contests','gh_research_candidates','gh_research_agent_assignments',
    'gh_research_tallies','gh_research_tally_candidate_votes','gh_research_exam_attempts',
    'gh_research_challenges','gh_research_challenge_participants','gh_research_challenge_events',
    'gh_social_poll_settings','gh_social_challenges','gh_social_challenge_participants','gh_social_challenge_events','gh_research_audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;
COMMIT;
