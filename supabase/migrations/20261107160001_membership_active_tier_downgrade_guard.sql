-- REVIEW_REQUIRED — additive database guard for active membership tier ordering.
-- Do not apply until Testnet/Mainnet migration histories are reconciled and this
-- trigger is validated against a disposable PostgreSQL database.
-- The server/API checks are user-facing safeguards; this row-level guard closes
-- the direct-RPC and concurrent-write path for an active VVIP -> VIP downgrade.

CREATE OR REPLACE FUNCTION public.ghc_membership_prevent_active_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.tier = 'vvip'
     AND OLD.active IS TRUE
     AND (OLD.expires_at IS NULL OR OLD.expires_at > now())
     AND NEW.tier = 'vip'
     AND NEW.active IS TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'MEMBERSHIP_DOWNGRADE_NOT_ALLOWED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ghc_membership_prevent_active_downgrade
  ON public.ghc_membership_entitlements;

CREATE TRIGGER ghc_membership_prevent_active_downgrade
BEFORE UPDATE OF tier, active, expires_at
ON public.ghc_membership_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.ghc_membership_prevent_active_downgrade();

COMMENT ON FUNCTION public.ghc_membership_prevent_active_downgrade() IS
  'Prevents an active, unexpired VVIP entitlement from being replaced by VIP; expiry, revocation and upgrades remain possible.';
