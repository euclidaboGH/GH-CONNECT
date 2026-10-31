# GreenHaven upgrade worklog — v0.157.22

Date: 2026-10-29

## Goal

Start the Pi App-to-User (A2U) earnings roadmap and incorporate the requested four-month 3% Pi cashback policy while keeping all user-facing entry points inside the existing Rewards Center and Wallet.

## Source audit findings

- Existing A2U routes are present but the create route is privileged, serialized and Testnet-only, and its durable request is `gh_seller_payout_requests`; this is not a general user-rewards withdrawal system.
- The append-only `gh_company_revenue_events` journal has verified source event IDs and company net revenue fields but no canonical paying-user attribution. The system therefore cannot safely calculate revenue attributable to a particular user without a source-to-user mapping layer.
- The A2U execution migration records the Pi Testnet network and seller-payout binding. It must not be silently reused for cashback entitlements.
- Cashback amounts require exact 10^-7 PI arithmetic and source-level revenue attribution; floating-point totals and client-provided spending are not acceptable.

## Changes in this increment

1. Added `docs/PI-A2U-EARNINGS-AND-CASHBACK-ROADMAP.md` with product layout, four-month UTC period proposal, 3% formula, source attribution requirements, exact PI precision, refund/chargeback treatment, idempotency, ledger/payout state model, security requirements, test plan and Mainnet gates.
2. Explicitly assigned Rewards Center as the earn/explain surface and Wallet as the claim/manage/receipt surface; no new top-level navigation section is proposed.
3. Added `scripts/check-a2u-earnings-roadmap.mjs` and registered it in the network/database-independent static suite. It checks the policy, known source-data limitation, A2U seller-payout binding, exact-precision design, and preservation of the Testnet gate.
4. Bumped package, lockfile, in-app release, project truth, README and current release documentation to `0.157.22`.
5. No database migration, new payout API, balance mutation, remote provider call, or Mainnet flag change was introduced. This avoids prematurely paying users from revenue data that cannot yet be safely attributed.

## Verification

- `node scripts/check-a2u-earnings-roadmap.mjs` — 12/12 passed.
- `node scripts/check-phase1-12-consolidation.mjs` — 24/24 passed.
- `node scripts/check-project-truth.mjs` — 10/10 passed.
- `node scripts/check-release-hygiene.mjs` — 11/11 passed; dependency lock integrity passed; migration inventory check passed (140 migrations: 98 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 39 REVIEW_REQUIRED).
- `node scripts/check-phase12-final-release-readiness.mjs` — 28/28 passed.
- `node scripts/verify-phase14-static.mjs` — 51/51 passed, including the new roadmap contract.

## Operational boundary

Source-level verification only; the local runtime is Node.js 22.16.0, below the supported Node.js 24.15.0 baseline, so full dependency installation, TypeScript, lint and production build must be rerun under Node.js 24.15.0 or a compatible later Node 24 release.

This increment adds the roadmap and audit guard, not the production feature itself. The next implementation increment must trace actual Pi revenue producers to verified source payment IDs and canonical paying-user IDs, design a reviewed migration and calculation RPC, validate it on disposable PostgreSQL, reconcile migration history, and only then implement the generic user-reward payout domain. Pi Mainnet A2U access and outgoing-wallet authorization must be confirmed with Pi. No source-only check establishes those external facts.
