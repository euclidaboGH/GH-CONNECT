-- Run #253: remove only two byte-for-byte equivalent duplicate indexes.
-- Keep uq_ghc_earned_posted_ref as the unique earned-credit idempotency guard;
-- keep idx_gh_community_reports_queue for the report status queue access path.
-- Neither removed index backs a PostgreSQL constraint.
BEGIN;
DROP INDEX IF EXISTS public.uq_ghc_earned_user_ref;
DROP INDEX IF EXISTS public.idx_gh_community_reports_status_created;
COMMIT;
