# GreenHaven upgrade worklog — v0.197.0

## Phase 20 — Marketplace net proceeds foundation

- Added an append-only per-order proceeds snapshot with currency, gross, 500-bps commission, seller net, payment rail and server-side payment evidence fingerprint.
- Snapshot creation is tied to a verified marketplace order payment state and rejects incomplete PI or GHC evidence bindings.
- Replaced seller payout request eligibility so it consumes verified seller-net snapshots rather than gross order totals.
- Added net-allocation conservation checks and service-role-only access controls.
- Added source-contract regression checks and registered them in static verification and prebuild.
- Classified migration `20261030010009_phase20_marketplace_net_proceeds.sql` as `REVIEW_REQUIRED`. It has not been applied to any database.

## Important review gates

- The SQL snapshot currently fixes commission at 500 bps. Confirm this matches the deployed product fee policy and all currency rounding rules before applying; do not silently assume an environment setting is equivalent.
- The payment evidence fingerprint is a consistency fingerprint, not a provider signature or cryptographic proof. Provider verification remains the responsibility of existing PI/GHC payment verification paths.
- Existing payout allocations created under the previous gross-based function are not rewritten. Reconcile historical requests and settlements before applying this migration.
- This phase does not yet implement refunds, chargebacks, dispute resolution, or seller-net reversals. Those require separately audited, append-only adjustment and settlement workflows.
- No disposable PostgreSQL, live Supabase, Pi Testnet, or GHC Testnet integration was available for runtime/concurrency validation in this work session.
- No deployment, Git push, or database mutation was performed.

- Verification scope: source-contract/static checks only. Node.js 24.15.0 is required; the available runtime is Node.js 22.16.0. No full TypeScript, lint, Next.js production build, PostgreSQL execution, or provider E2E is claimed.

This increment is source-only verification and does not replace isolated helper tests, PostgreSQL execution, or Testnet acceptance.


Historical release verification boundary: the v0.197.0 checks were source-only; runtime, PostgreSQL and Testnet limitations were not converted into acceptance claims. The current release is v0.198.0; see `docs/UPGRADE-WORKLOG-0.198.0.md`.
