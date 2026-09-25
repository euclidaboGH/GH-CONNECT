-- Durable verification request queue (additive).
-- Service-role only; clients never write directly.
-- Submitting a request NEVER grants verified status.

CREATE TABLE IF NOT EXISTS public.gh_verification_requests (
  id              text PRIMARY KEY,
  user_id         text NOT NULL,
  type            text NOT NULL
    CHECK (type IN ('identity','creator','business','organization')),
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','revoked','cancelled')),
  note            text,
  evidence_refs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_id     text,
  review_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_verif_req_user
  ON public.gh_verification_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_verif_req_status
  ON public.gh_verification_requests (status, created_at DESC);

-- At most one open pending request per user+type
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_verif_req_pending_user_type
  ON public.gh_verification_requests (user_id, type)
  WHERE status = 'pending';

ALTER TABLE public.gh_verification_requests ENABLE ROW LEVEL SECURITY;

-- No client policies — service role only (fail closed for anon/authenticated JWT)

COMMENT ON TABLE public.gh_verification_requests IS
  'Verification request queue. status=pending does not imply badge/trust. Approve only via privileged review API.';
