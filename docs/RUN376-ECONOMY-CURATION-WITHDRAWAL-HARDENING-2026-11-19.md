# RUN376 — Phase 3 economy, curation, withdrawal and pipeline hardening

RUN376 continues from source package 0.338.102 and produces 0.338.103.

## Highest-risk findings addressed

- **Curation concentration:** the previous anti-whale function clipped each vote at 12% of the pre-cap total, then normalized confidence against the smaller capped sum. That allowed a whale to exceed 12% of final influence. Water-filling redistribution now caps final shares (12% where feasible; 1/N for panels smaller than nine) and preserves total weight.
- **Duplicate reviewer identity:** duplicate rows could be counted as multiple independent participants. Every occurrence of a duplicate reviewer is excluded from consensus and reviewer effects.
- **Calibration state availability:** a failed calibration REST read previously returned an empty map, causing default calibration values to be prepared for commit. Settlement now stops if the durable read is unavailable or malformed.
- **Population fallback:** DB-backed reward calculations could fall back to an artificial population of one after a failed population RPC. This now fails closed.
- **Global emission concurrency:** daily claims used process-memory demand, while activity emissions used separate durable demand reads and increments. The two paths could undercount concurrent cross-instance demand. Source now uses a single atomic Postgres reservation design for both paths; daily claim v13 wraps demand reservation and the existing v12 pending claim in one transaction, while activity v2 wraps user caps and global demand in one transaction. The proposal idempotently backfills historical daily-claim demand from ledger metadata.
- **Withdrawal destination control:** GHC-to-Pi request creation previously accepted a body-supplied wallet address without a request-bound PIN proof and exact platform-verified wallet authorization. Those are now required.

## Atomic emission activation contract

The SQL is deliberately held at `supabase/proposals/20261119_atomic_global_emission_allocator_v13_review.sql`. It is not a canonical migration and has not been executed. The source has a strict operator gate:

`GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED=true`

Do not set it until:
- Testnet migration history is reconciled to exact live schema/function definitions.
- The proposal is rehearsed on an isolated disposable Testnet branch.
- Daily claims, activity demand reservations, concurrent users, duplicate idempotency, failure compensation, budget exhaustion and rollback are tested.
- The live Testnet functions and SECURITY DEFINER grants/search paths are verified after application.

The default is false. DB-backed issuance returns 503 until the gate is explicitly enabled. It does not silently use process memory.

## Withdrawal controls

GHC-to-Pi withdrawal enablement requires all of:
- `GHC_WITHDRAWALS_ENABLED=true`
- `GHC_WITHDRAWALS_TESTNET_ONLY=true`
- `PI_NETWORK=testnet`
- `VERCEL_ENV` must not be `production` (Preview or local Testnet only).

Each request additionally requires a valid request-bound PIN proof, an existing mapped Pi identity, active wallet authorization and a wallet address whose source is `platform_api` and which exactly matches the requested destination. The endpoint creates a request only; it does not send Pi. Completion still requires operator verification and the existing atomic GHC settlement RPC.

## Verification and release status

Targeted gates and runtime checks are recorded in `docs/UPGRADE-WORKLOG-0.338.103.md`. No live schema, ledger, payout, payment, GitHub, Vercel or Mainnet state was changed. Full Node 24.15.x typecheck/lint/build, browser/device acceptance and Testnet concurrency acceptance remain outstanding. Production is NOT APPROVED.


## Balance-funded curation replay safety

The existing SQL implementation rounds redistribution to four decimal places. The source now rounds the percentage-derived contribution to that exact precision and rejects unsupported amounts before RPC. A separate review-only proposal, `supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql`, adds a wrapper that locks the reference and returns the original ledger amount on a retry, including when the caller resubmits a different percentage. The source calls only the v2 wrapper, behind `GHC_CURATION_REDISTRIBUTE_V2_ENABLED=false` by default. The feature remains a transfer of already-owned GHC, never issuance.

**Remaining GHPV calibration limit:** the deployed `gh_curator_calibration` schema does not persist `day_key` or `day_delta_abs`, and the current settlement loader cannot enforce `MAX_JCS_DELTA_PER_DAY` across separate settlement transactions. The source now fails closed on unavailable/malformed calibration reads, but the daily calibration cap is not certified as durable. Keep automated GHPV settlement disabled until a per-reviewer-serialized SQL calibration/day-cap proposal is designed, rehearsed and verified. This does not mint or mutate GHC.
