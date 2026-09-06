-- PROPOSAL ONLY — NOT APPLIED BY AGENT
-- Community moderation log + safety reports (additive, non-destructive)
-- Operator must review and apply manually. Does not touch GHC/Pi tables.

-- BEGIN PROPOSAL

CREATE TABLE IF NOT EXISTS public.ghc_community_moderation_log (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghc_cml_community_created
  ON public.ghc_community_moderation_log (community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ghc_community_reports (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolver_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ghc_cr_community_status
  ON public.ghc_community_reports (community_id, status, created_at DESC);

ALTER TABLE public.ghc_community_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_community_reports ENABLE ROW LEVEL SECURITY;

-- No broad client write policies — service role / SECURITY DEFINER RPCs only (future).

COMMENT ON TABLE public.ghc_community_moderation_log IS
  'PROPOSAL: community moderation audit log — apply manually; not financial';

COMMENT ON TABLE public.ghc_community_reports IS
  'PROPOSAL: community safety reports — apply manually; not financial';

-- END PROPOSAL
