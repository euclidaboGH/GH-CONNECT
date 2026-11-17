-- Run #269: revoke direct client mutation privileges from the exposed public schema.
-- Applied to GH Connect Testnet only under generated history version 20261110174922.
-- No rows, balances, ledger entries, payment intents, payout requests, or storage objects are changed.
-- Existing SELECT grants and RLS policies are preserved; server-side service_role access is preserved.
-- Mainnet remains inactive and this source migration is REVIEW_REQUIRED for any other target.

BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

REVOKE USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public
  FROM anon, authenticated;

-- Future application objects created by the postgres migration owner fail closed by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
