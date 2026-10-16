-- =============================================================================
-- 20261013_ghpv_judgment_infrastructure.sql
-- GHPV-1: Judgment infrastructure (NO GHC mutation, NO vote-minting).
-- Extends curation/reputation foundations without changing financial RPCs.
-- SECURITY DEFINER RPCs granted to service_role only.
-- =============================================================================

-- Content-level quality state (server-maintained snapshot)
CREATE TABLE IF NOT EXISTS public.gh_content_quality_state (
  content_id        text PRIMARY KEY,
  content_kind      text NOT NULL DEFAULT 'post'
                    CHECK (content_kind IN ('post', 'comment', 'other')),
  judgment_mode     text NOT NULL DEFAULT 'useful'
                    CHECK (judgment_mode IN (
                      'factual', 'useful', 'creative', 'opinion', 'harm'
                    )),
  quality_score     numeric(8, 4) NOT NULL DEFAULT 0,
  confidence        numeric(8, 4) NOT NULL DEFAULT 0
                    CHECK (confidence >= 0 AND confidence <= 100),
  upvote_weight     numeric(18, 6) NOT NULL DEFAULT 0,
  downvote_weight   numeric(18, 6) NOT NULL DEFAULT 0,
  independent_voters integer NOT NULL DEFAULT 0 CHECK (independent_voters >= 0),
  settlement_status text NOT NULL DEFAULT 'open'
                    CHECK (settlement_status IN (
                      'open', 'pending', 'settled', 'quarantined'
                    )),
  settled_at        timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_cqs_content_nonempty CHECK (length(trim(content_id)) > 0)
);

ALTER TABLE public.gh_content_quality_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_cqs_no_client ON public.gh_content_quality_state;
CREATE POLICY gh_cqs_no_client ON public.gh_content_quality_state
  FOR ALL USING (false) WITH CHECK (false);

-- Curator calibration (JCS foundation)
CREATE TABLE IF NOT EXISTS public.gh_curator_calibration (
  user_id           text PRIMARY KEY,
  jcs               numeric(8, 4) NOT NULL DEFAULT 50
                    CHECK (jcs >= 0 AND jcs <= 100),
  correct_count     integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  incorrect_count   integer NOT NULL DEFAULT 0 CHECK (incorrect_count >= 0),
  unresolved_count  integer NOT NULL DEFAULT 0 CHECK (unresolved_count >= 0),
  integrity_score   numeric(8, 4) NOT NULL DEFAULT 70
                    CHECK (integrity_score >= 0 AND integrity_score <= 100),
  curation_power    numeric(12, 6) NOT NULL DEFAULT 1
                    CHECK (curation_power >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_cal_user_nonempty CHECK (length(trim(user_id)) > 0)
);

ALTER TABLE public.gh_curator_calibration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_cal_no_client ON public.gh_curator_calibration;
CREATE POLICY gh_cal_no_client ON public.gh_curator_calibration
  FOR ALL USING (false) WITH CHECK (false);

-- Judgment settlement records (idempotent epochs)
CREATE TABLE IF NOT EXISTS public.gh_judgment_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        text NOT NULL,
  settlement_epoch  text NOT NULL,
  confidence        numeric(8, 4) NOT NULL DEFAULT 0
                    CHECK (confidence >= 0 AND confidence <= 100),
  consensus_choice  text
                    CHECK (consensus_choice IS NULL OR consensus_choice IN (
                      'upvote', 'downvote', 'neutral', 'unresolved'
                    )),
  quality_delta     numeric(8, 4) NOT NULL DEFAULT 0,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_js_content_nonempty CHECK (length(trim(content_id)) > 0),
  CONSTRAINT gh_js_epoch_nonempty CHECK (length(trim(settlement_epoch)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_judgment_settlement_epoch
  ON public.gh_judgment_settlements (content_id, settlement_epoch);

ALTER TABLE public.gh_judgment_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_js_no_client ON public.gh_judgment_settlements;
CREATE POLICY gh_js_no_client ON public.gh_judgment_settlements
  FOR ALL USING (false) WITH CHECK (false);

-- Per-reviewer outcome on a settlement (calibration input; no GHC)
CREATE TABLE IF NOT EXISTS public.gh_judgment_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id     uuid NOT NULL REFERENCES public.gh_judgment_settlements(id),
  reviewer_id       text NOT NULL,
  choice            text NOT NULL
                    CHECK (choice IN ('upvote', 'downvote', 'neutral')),
  alignment         text NOT NULL DEFAULT 'unresolved'
                    CHECK (alignment IN (
                      'aligned', 'misaligned', 'neutral', 'unresolved', 'protected'
                    )),
  jcs_delta         numeric(8, 4) NOT NULL DEFAULT 0,
  idempotency_key   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_je_reviewer_nonempty CHECK (length(trim(reviewer_id)) > 0),
  CONSTRAINT gh_je_idem_nonempty CHECK (length(trim(idempotency_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_judgment_event_idem
  ON public.gh_judgment_events (idempotency_key);

ALTER TABLE public.gh_judgment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_je_no_client ON public.gh_judgment_events;
CREATE POLICY gh_je_no_client ON public.gh_judgment_events
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_content_quality_state IS
  'GHPV-1 server quality snapshot; not a balance; clients cannot write.';
COMMENT ON TABLE public.gh_curator_calibration IS
  'GHPV-1 JCS/CP foundation; vote weight never from GHC balance.';
COMMENT ON TABLE public.gh_judgment_settlements IS
  'GHPV-1 consensus settlement epochs; no GHC minting.';
COMMENT ON TABLE public.gh_judgment_events IS
  'GHPV-1 per-reviewer calibration outcomes; no GHC.';
