-- READ-ONLY GHC seller-payout treasury preflight.
-- Run after migrations 20261009, 20261010, 202610250003, 202610250004 and 202610250007 have been reviewed/applied.
-- Replace the placeholder with the exact configured treasury user ID before running.
-- Do not paste private keys, wallet seed phrases, or service-role keys into this query.
WITH params AS (
  SELECT 'REPLACE_WITH_GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID'::text AS treasury_user_id
), balance AS (
  SELECT p.treasury_user_id,
         public.ghc_available_balance(p.treasury_user_id) AS ledger_balance,
         public.ghc_spendable_balance(p.treasury_user_id) AS spendable_balance,
         EXISTS (SELECT 1 FROM public.ghc_account_flags f WHERE f.user_id=p.treasury_user_id AND (f.restricted OR f.suspended)) AS restricted_or_suspended,
         (SELECT COALESCE(sum(t.amount),0) FROM public.ghc_transactions t WHERE t.user_id=p.treasury_user_id AND t.status='posted' AND t.kind='purchased' AND t.amount>0) AS positive_purchased_ledger_ghc
  FROM params p
)
SELECT *,
       treasury_user_id <> 'REPLACE_WITH_GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID' AS treasury_id_replaced,
       spendable_balance > 0 AS has_spendable_funds,
       (treasury_user_id <> 'REPLACE_WITH_GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID' AND spendable_balance > 0 AND NOT restricted_or_suspended) AS candidate_for_manual_review
FROM balance;

-- Any paid GHC payout missing an atomic settlement record is a release blocker.
SELECT p.id AS payout_request_id, p.seller_id, p.amount, p.status, p.payout_reference,
       s.id AS settlement_id, s.transfer_reference, s.treasury_user_id,
       d.id AS debit_id, c.id AS credit_id,
       CASE WHEN p.status='paid' AND s.id IS NULL THEN 'BLOCKER_PAID_WITHOUT_SETTLEMENT'
            WHEN s.id IS NOT NULL AND (d.id IS NULL OR c.id IS NULL OR abs(d.amount)<>s.amount OR c.amount<>s.amount) THEN 'BLOCKER_LEDGER_PAIR_MISMATCH'
            ELSE 'OK' END AS audit_result
FROM public.gh_seller_payout_requests p
LEFT JOIN public.gh_seller_payout_ghc_settlements s ON s.payout_request_id=p.id
LEFT JOIN public.ghc_transactions d ON d.id=s.debit_transaction_id AND d.reference_id=s.transfer_reference AND d.kind='transfer_out' AND d.status='posted'
LEFT JOIN public.ghc_transactions c ON c.id=s.credit_transaction_id AND c.reference_id=s.transfer_reference AND c.kind='transfer_in' AND c.status='posted'
WHERE p.currency='GHC' AND (p.status='paid' OR s.id IS NOT NULL)
ORDER BY p.created_at DESC;

-- Current outstanding GHC payout queue, by state. No rows are modified.
SELECT status, count(*) AS request_count, COALESCE(sum(amount),0) AS requested_ghc
FROM public.gh_seller_payout_requests
WHERE currency='GHC'
GROUP BY status ORDER BY status;

-- Review funding composition; positive balance alone is not proof of approved treasury funding.
WITH params AS (SELECT 'REPLACE_WITH_GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID'::text AS treasury_user_id)
SELECT t.kind, count(*) AS ledger_rows, sum(t.amount) AS net_ghc
FROM public.ghc_transactions t CROSS JOIN params p
WHERE t.user_id=p.treasury_user_id AND t.status='posted'
GROUP BY t.kind ORDER BY t.kind;
