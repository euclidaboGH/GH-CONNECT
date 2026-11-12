-- Phase 6: Daily Claim is the only permitted source of new user-available GHC.
-- Transfers remain redistribution. Existing ledger history is not rewritten.
-- Apply to TESTNET only after migration-history/schema reconciliation and review.

CREATE OR REPLACE FUNCTION public.ghc_enforce_daily_claim_only_issuance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event text := upper(trim(coalesce(NEW.source_event, '')));
  v_kind text := lower(trim(coalesce(NEW.kind, '')));
  v_status text := lower(trim(coalesce(NEW.status, '')));
  v_metadata jsonb := coalesce(NEW.metadata, '{}'::jsonb);
BEGIN
  -- Updates that do not post a transaction (for example expiring an old pending
  -- entitlement) do not create spendable value and must remain possible.
  IF TG_OP = 'UPDATE' AND v_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  -- Non-positive ledger entries are not issuance. Negative compensating entries
  -- remain auditable; spend/transfer-out records retain their existing semantics.
  IF coalesce(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Existing GHC may move between users only through the atomic transfer RPC.
  IF v_kind = 'transfer_in'
     AND v_status = 'posted'
     AND v_event = 'WALLET_TRANSFER'
     AND NEW.reference_id IS NOT NULL
     AND NEW.counterparty_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.ghc_transactions AS debit
       WHERE debit.kind = 'transfer_out'
         AND debit.status = 'posted'
         AND debit.source_event = 'WALLET_TRANSFER'
         AND debit.reference_id = NEW.reference_id
         AND debit.user_id = NEW.counterparty_id
         AND debit.counterparty_id = NEW.user_id
         AND debit.amount = -NEW.amount
     ) THEN
    RETURN NEW;
  END IF;

  -- Daily Claim entitlement must be staged with the 48-hour lifecycle metadata.
  IF v_kind = 'earned'
     AND v_event = 'DAILY_CLAIM_V12'
     AND NEW.user_id <> '__PROTOCOL_RESERVE__'
     AND (
       (v_status = 'pending' AND v_metadata->>'rewardLifecycle' = 'daily_claim_48h')
       OR (v_status = 'posted' AND v_metadata->>'claimKind' = 'DAILY_CLAIM_V12')
     ) THEN
    RETURN NEW;
  END IF;

  -- The reserve leg is part of the same Daily Claim protocol operation and is
  -- not user-available wallet value. It must remain on the dedicated reserve ID.
  IF v_kind = 'earned'
     AND v_status = 'posted'
     AND v_event = 'PROTOCOL_RESERVE_V12'
     AND NEW.user_id = '__PROTOCOL_RESERVE__'
     AND nullif(v_metadata->>'forUserId', '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'GHC_ISSUANCE_POLICY_VIOLATION',
    DETAIL = 'Only Daily Claim may issue new user GHC; positive ledger credits outside the approved claim or transfer paths are blocked.';
END;
$$;

DROP TRIGGER IF EXISTS ghc_daily_claim_only_issuance_guard ON public.ghc_transactions;
CREATE TRIGGER ghc_daily_claim_only_issuance_guard
BEFORE INSERT OR UPDATE OF amount, kind, status, source_event, user_id
ON public.ghc_transactions
FOR EACH ROW
EXECUTE FUNCTION public.ghc_enforce_daily_claim_only_issuance();

REVOKE ALL ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() TO service_role;

-- Generic staged activity/achievement/referral rewards are no longer callable
-- from the application service role. The trigger above remains the database-level
-- safety net for existing SECURITY DEFINER functions and direct privileged paths.
DO $$
BEGIN
  IF to_regprocedure('public.ghc_stage_pending(text,numeric,text,text,text,text,integer,bigint,integer,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.ghc_stage_pending(text,numeric,text,text,text,text,integer,bigint,integer,text) FROM PUBLIC, anon, authenticated, service_role;
  END IF;
END;
$$;

-- Preserve curation voting, but turn off the reward side effect without making
-- a vote fail. The existing atomic wrapper receives an explicit non-credit result.
CREATE OR REPLACE FUNCTION public.ghc_curation_reward_credit(
  p_user_id text,
  p_post_id text,
  p_choice text,
  p_percentage numeric DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'credited', false,
    'amount', 0,
    'status', 'disabled',
    'reason', 'GHC_ISSUANCE_POLICY_LOCKED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) TO service_role;

COMMENT ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() IS
  'Phase 6 ledger guard: permits Daily Claim 48-hour entitlements, the protocol reserve leg, and atomic wallet transfers; blocks other positive credits.';
COMMENT ON FUNCTION public.ghc_curation_reward_credit(text, text, text, numeric) IS
  'GHC curation rewards are disabled under the Daily-Claim-only issuance policy; curation votes remain available.';
