-- Amend Daily-Claim-only issuance guard to also allow:
-- 1) REFERRAL_REWARD_V1 earned posts with required metadata
-- 2) Curation redistribution: transfer_out + transfer_in with source CURATION_REDISTRIBUTE_V1
-- Does not enable settlement by itself; application feature flags still gate callers.

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
  IF TG_OP = 'UPDATE' AND v_status <> 'posted' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Wallet transfers (including orphan-complete receive legs)
  IF v_kind = 'transfer_in'
     AND v_status = 'posted'
     AND v_event IN ('WALLET_TRANSFER', 'WALLET_TRANSFER_ORPHAN_COMPLETE')
     AND NEW.reference_id IS NOT NULL
     AND NEW.counterparty_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.ghc_transactions AS debit
       WHERE debit.kind = 'transfer_out'
         AND debit.status = 'posted'
         AND debit.reference_id = NEW.reference_id
         AND debit.user_id = NEW.counterparty_id
         AND debit.counterparty_id = NEW.user_id
         AND abs(debit.amount) = NEW.amount
     ) THEN
    RETURN NEW;
  END IF;

  -- Curation redistribution credit (must match debit)
  IF v_kind = 'transfer_in'
     AND v_status = 'posted'
     AND v_event = 'CURATION_REDISTRIBUTE_V1'
     AND NEW.reference_id IS NOT NULL
     AND NEW.counterparty_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.ghc_transactions d
       WHERE d.kind = 'transfer_out'
         AND d.status = 'posted'
         AND d.source_event = 'CURATION_REDISTRIBUTE_V1'
         AND d.reference_id = NEW.reference_id
         AND d.user_id = NEW.counterparty_id
         AND d.counterparty_id = NEW.user_id
         AND abs(d.amount) = NEW.amount
     ) THEN
    RETURN NEW;
  END IF;

  -- Daily Claim
  IF v_kind = 'earned'
     AND v_event = 'DAILY_CLAIM_V12'
     AND NEW.user_id <> '__PROTOCOL_RESERVE__'
     AND (
       (v_status = 'pending' AND v_metadata->>'rewardLifecycle' = 'daily_claim_48h')
       OR (v_status = 'posted' AND v_metadata->>'claimKind' = 'DAILY_CLAIM_V12')
     ) THEN
    RETURN NEW;
  END IF;

  IF v_kind = 'earned'
     AND v_status = 'posted'
     AND v_event = 'PROTOCOL_RESERVE_V12'
     AND NEW.user_id = '__PROTOCOL_RESERVE__' THEN
    RETURN NEW;
  END IF;

  -- Qualifying referral reward (5% of VIP GHC charge) — dedicated path only
  IF v_kind = 'earned'
     AND v_status = 'posted'
     AND v_event = 'REFERRAL_REWARD_V1'
     AND NEW.user_id <> '__PROTOCOL_RESERVE__'
     AND v_metadata->>'rewardKind' = 'REFERRAL_REWARD_V1'
     AND NEW.reference_id IS NOT NULL
     AND NEW.reference_id LIKE 'referral_reward_%' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'GHC_ISSUANCE_BLOCKED: kind=% event=% status=% (only Daily Claim + gated referral + verified redistribution allowed)',
    v_kind, v_event, v_status
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.ghc_enforce_daily_claim_only_issuance() IS
  'Allows Daily Claim lifecycle, REFERRAL_REWARD_V1, and verified transfer/curation redistribution. Blocks other positive earned posts.';
