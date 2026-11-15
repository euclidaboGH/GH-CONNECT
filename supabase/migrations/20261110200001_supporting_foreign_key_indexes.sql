-- Run #255: add the eleven missing FK-supporting btree indexes reported by
-- Supabase's database advisor. These indexes do not change ledger or business data.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_operator_actions_request_id
  ON public.gh_bank_payout_operator_actions (payout_request_id);
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_requests_beneficiary_id
  ON public.gh_bank_payout_requests (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_gh_bank_payout_webhook_events_request_id
  ON public.gh_bank_payout_webhook_events (payout_request_id);
CREATE INDEX IF NOT EXISTS idx_gh_charity_contributions_platform_entry_id
  ON public.gh_charity_contributions (platform_entry_id);
CREATE INDEX IF NOT EXISTS idx_gh_earnings_ledger_entries_related_entry_id
  ON public.gh_earnings_ledger_entries (related_entry_id);
CREATE INDEX IF NOT EXISTS idx_gh_judgment_events_settlement_id
  ON public.gh_judgment_events (settlement_id);
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_refund_operations_adjustment_id
  ON public.gh_marketplace_refund_operations (adjustment_id);
CREATE INDEX IF NOT EXISTS idx_gh_post_comments_parent_id
  ON public.gh_post_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_gh_saves_post_id
  ON public.gh_saves (post_id);
CREATE INDEX IF NOT EXISTS idx_gh_seller_payout_correction_approvals_order_id
  ON public.gh_seller_payout_correction_approvals (order_id);
CREATE INDEX IF NOT EXISTS idx_ghc_connection_contexts_request_id
  ON public.ghc_connection_contexts (request_id);
COMMIT;
