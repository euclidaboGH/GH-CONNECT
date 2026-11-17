-- Run #254: remove provably redundant permissive RLS policies and evaluate
-- auth.uid() once per statement rather than once per row.
-- RLS remains enabled; policies that remain are the only allowed read paths.
BEGIN;

ALTER POLICY ghc_tx_select_own ON public.ghc_transactions
  USING (((SELECT auth.uid())::text = user_id));
ALTER POLICY ghc_req_select_party ON public.ghc_transfer_requests
  USING (((SELECT auth.uid())::text = requester_id) OR ((SELECT auth.uid())::text = payer_id));
ALTER POLICY ghc_economy_events_select_own ON public.ghc_economy_events
  USING (((SELECT auth.uid())::text = user_id));
ALTER POLICY ghc_referral_attr_select_party ON public.ghc_referral_attributions
  USING (((SELECT auth.uid())::text = referred_user_id) OR ((SELECT auth.uid())::text = referrer_user_id));
ALTER POLICY ghc_referral_codes_select_own ON public.ghc_referral_codes
  USING (((SELECT auth.uid())::text = user_id));
ALTER POLICY ghc_referral_rewards_select_own ON public.ghc_referral_rewards
  USING (((SELECT auth.uid())::text = referrer_user_id));

-- Each dropped ALL/false policy overlapped a more specific SELECT policy.
-- With RLS enabled and no INSERT/UPDATE/DELETE policy, client writes remain denied.
DROP POLICY IF EXISTS ghc_events_select_own ON public.ghc_economy_events;
DROP POLICY IF EXISTS ghc_public_identities_no_client_write ON public.ghc_public_identities;
DROP POLICY IF EXISTS ghc_referral_attr_no_client_write ON public.ghc_referral_attributions;
DROP POLICY IF EXISTS ghc_referral_codes_no_client_write ON public.ghc_referral_codes;
DROP POLICY IF EXISTS ghc_referral_rewards_no_client_write ON public.ghc_referral_rewards;
DROP POLICY IF EXISTS ghc_req_no_client_mutate ON public.ghc_transfer_requests;
DROP POLICY IF EXISTS ghc_transfer_requests_no_client_write ON public.ghc_transfer_requests;
DROP POLICY IF EXISTS ghc_user_accounts_no_client_write ON public.ghc_user_accounts;

COMMIT;
