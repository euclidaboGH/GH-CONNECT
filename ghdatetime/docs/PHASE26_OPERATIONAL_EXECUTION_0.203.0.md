# Phase 26 — Operational execution paths (0.203.0)

## Governing rule
Canonical orders, adjustments, payout requests, and membership entitlements remain the **sole authority**.  
No second balance, duplicate entitlement, or client-controlled financial state.

## Delivered

| Workflow | Server path | Notes |
|----------|-------------|--------|
| Refund request | `gh_marketplace_begin_refund_request` + operator `action=request` | Phase only — **not** completed |
| Provider confirmed refund | `gh_marketplace_record_provider_refund` + `action=confirm|fail` | Caller must verify provider first |
| Dispute decision | `gh_marketplace_record_dispute_decision` | Journal only |
| Dispute financial link | `gh_marketplace_apply_dispute_adjustment` | Adjustment; still not a provider refund |
| Payout correction dry-run | TS `dryRunPayoutCorrection` | Blocks if settlement not verified |
| Payout correction approve/apply | SQL approval + apply as **adjustment only** | Never rewrites allocation history |
| Membership renew | `ghc_membership_renew_from_verified_intent` | Verified intent required |

## Operator APIs
All require `x-ghc-operator-key` (≥32 byte secret):
- `POST /api/operator/operational/refunds`
- `POST /api/operator/operational/disputes`
- `POST /api/operator/operational/payout-corrections`
- `POST /api/operator/operational/membership-renew`

## Migration
`20261030010015_phase26_operational_execution_paths.sql` — **REVIEW_REQUIRED**, not auto-applied.

## Limits
Source verification only. Disposable PostgreSQL + Testnet provider evidence still required before production approval.
