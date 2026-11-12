# Run #295 — six held migrations: source hardening and readiness

**Source baseline:** GreenHaven 0.338.55 / Run #291 (`ghtytrr.zip`)
**Scope:** six `REVIEW_REQUIRED` SQL migrations only.
**Execution:** source-only. No Supabase DDL was applied; no migration history was edited; no push/deploy occurred.

## Disposition

| Migration | Work completed | Current disposition |
|---|---|---|
| `20261107160001_membership_active_tier_downgrade_guard.sql` | Pinned trigger search path; trigger-only function execution revoked from client/service roles; preserves active, unexpired VVIP downgrade block while allowing expiry/revocation/upgrades. | HOLD — disposable PostgreSQL trigger rehearsal still required. |
| `20261107180001_marketplace_sku_variants_atomic_inventory.sql` | Pinned all SECURITY DEFINER search paths; explicit server-only ACLs; malformed quantity now fails validation; stock release/commit no longer clamps negative counters to zero and instead aborts if the reserved quantity invariant is broken. | HOLD — clean-schema, concurrent reservation, payment, cancellation, expiry, and retry rehearsal required. |
| `20261107190001_marketplace_fulfilment_tracking_timeline.sql` | Pinned SECURITY DEFINER search paths; retains the canonical Phase 21 event journal and its existing event vocabulary; no duplicate event table or settlement/escrow logic introduced. | HOLD — PostgreSQL rehearsal and buyer/seller lifecycle tests required. |
| `20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` | Pinned SECURITY DEFINER search paths; qualified advisory-lock calls; retains serialized membership purchase and reward-claim paths; replaced the stale payout cancellation definition with the newer Run #291 implementation verbatim, including receipt, provider verification, and lease evidence checks. | HOLD — verify exact live function/table contracts and run concurrency/idempotency rehearsal. |
| `20261109100001_gh_messaging_phase1_controls_search.sql` | Pinned SECURITY DEFINER search paths; retains service-role-only RPCs, active-membership checks, bounded search, and receipt preference behavior. | HOLD — disposable PostgreSQL and membership/privacy/receipt tests required. |
| `20261110210001_pi_a2u_ecosystem_qualification.sql` | Pinned SECURITY DEFINER search paths; retains operator-attested KYC and distinct Testnet A2U evidence model; bounds provider metadata to 16 KiB; does not create or execute payments. | HOLD — operator process review and PostgreSQL rehearsal required. |

## Important safety decisions

- Do not apply the original #196 payout cancellation body. It is stale relative to the Run #291 provider-evidence release boundary. The corrected #196 file now preserves the newer function, which only releases a request when every provider-evidence and execution-start field proves it never started.
- Do not treat a missing Pi payment ID as proof of non-execution. Processing/uncertain payout requests remain reserved pending authoritative provider reconciliation.
- Do not accept inventory underflow by applying `greatest(0, ...)`. A mismatch now raises an invariant exception and rolls back the order transition.
- The fulfilment migration reuses the existing Phase 21 immutable event journal. It must not create a parallel event table or change payment/escrow settlement semantics.
- The A2U qualification migration records independently verified provider evidence only. It does not initiate A2U transfers and does not infer Pioneer KYC status from Pi login.
- All six remain `REVIEW_REQUIRED` in the canonical manifest. They are not approved for `supabase db push` or direct SQL application yet.

## Source verification performed

- `scripts/test-held-migrations-readiness.mjs` — PASS.
- `scripts/check-phase93-marketplace-variants.mjs` — PASS, 26/26 after updating assertions to enforce fail-closed inventory invariants.
- `scripts/test-phase92-product-options.mjs` — PASS, 9/9.
- `scripts/check-phase94-marketplace-fulfilment.mjs` — PASS, 28/28.
- `scripts/test-phase94-marketplace-fulfilment.mjs` — PASS, 15/15.
- `scripts/check-phase3-wallet-rewards-membership-closeout.mjs` — PASS, 43/43 after aligning the test with the stricter provider-evidence predicate.
- `scripts/check-phase3-rewards-membership-request-guards.mjs` — PASS, 10/10.
- `scripts/check-priority9-message-search.mjs` — PASS, 10/10.
- `scripts/check-run261-a2u-ecosystem-qualification.mjs` — PASS, 16/16.
- `scripts/test-run291-payout-release-safety.mjs` — PASS, 15/15.
- `scripts/check-run257-marketplace-a2u-integration.mjs` — PASS, 15/15.
- `scripts/check-migration-source-manifest.mjs` — PASS, 221/221.
- `npm run verify:static` — PASS, including the new held-migration gate.

These are source-contract checks, not a PostgreSQL execution. This runtime has no PostgreSQL server/client or Docker available, so no claim is made that these SQL files have passed a database parser, clean install, or transactional concurrency test. Those are the remaining gates before marking any of the six `REQUIRED` or applying them to Testnet.

## Next safe application sequence

After a disposable PostgreSQL rehearsal against the exact required predecessor schema:

1. #192 membership downgrade guard.
2. #194 marketplace SKU variants and inventory.
3. #195 fulfilment timeline (after #194 and Phase 21 event journal).
4. #196 membership/reward concurrency recovery (after wallet/earnings predecessor functions are verified).
5. #199 messaging controls/search (after all four documented messaging predecessors).
6. #216 Pi A2U qualification (after Pi identity mapping and operator API are verified).

This is a dependency-oriented test order, not permission to apply. Reconcile Testnet and Mainnet migration history independently and apply one approved migration at a time only after the user authorizes it.

## Read-only Testnet preflight (2026-11-12)

The active GH Connect Testnet project was queried read-only. None of the six held migrations appears in its current migration history. The expected target objects are also absent where the migrations are intended to add them:

- #192: `ghc_membership_entitlements` exists; the downgrade-guard trigger does not.
- #194: marketplace listings/orders and the legacy reservation/get/listing RPCs exist; `gh_marketplace_variants` and the order variant columns do not.
- #195: the Phase 21 immutable marketplace event journal, event function, and message receipt table exist; fulfilment columns do not. Its `variant_id`/variant snapshot fields depend on #194 first.
- #196: membership entitlements, GHC transactions, payout requests, and all three target RPCs exist. The live membership-purchase and reward-claim definitions do not yet include the per-account advisory locks. The live payout cancellation function already includes provider receipt and lease-expiry guards; the corrected source preserves those guards.
- #199: conversation members/messages and message receipts exist; quick-reaction/read-receipt preference columns, message search vector, and nickname table do not.
- #216: Pi identity mapping exists; the two qualification tables do not.

The live Testnet `ghc_purchase_membership` and `ghc_claim_pending` functions currently have `search_path=public`; the corrected #196 source pins them to `pg_catalog, public, pg_temp`. Several existing marketplace helper functions also retain `search_path=public`; the held migrations replace only the named functions they own, and do not attempt a broad unrelated rewrite.

This preflight confirms that the six feature objects are still pending and that their principal prerequisites are present. It does not replace a clean PostgreSQL rehearsal, and it does not authorize applying them.
