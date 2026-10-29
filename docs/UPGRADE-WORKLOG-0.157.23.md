# GreenHaven upgrade worklog — v0.157.23

Date: 2026-10-29

## Scope

Continue the approved Pi A2U earnings roadmap by implementing the first financial foundation for four-month cashback, while keeping the feature inside Rewards Center and Wallet and preserving the Testnet-only A2U safety gate.

## Implemented

1. Added `supabase/migrations/20261029010001_pi_cashback_attribution_and_period_ledger.sql` (classified `REVIEW_REQUIRED`):
   - adds nullable canonical payer attribution, explicit opt-in eligibility and original-source linkage for compensation events to the append-only company-revenue journal;
   - adds a service-role-only attributed append RPC with payer/source conflict checks;
   - requires eligible refunds/chargebacks to reference an existing eligible original PI revenue event belonging to the same payer;
   - adds four-month UTC period records and per-user cashback entitlement rows; entitlement rows are immutable and explicitly marked `calculated`, not withdrawable;
   - calculates 3% in integer 10^-7 PI atomic units with floor rounding and clamps negative net revenue to zero;
   - makes period windows unique independent of policy version, prevents early period close, and returns the existing result on matching close retries/concurrent closes.
2. Extended `lib/server/revenue/revenue-event.ts` to route attributed events to the new RPC, require a canonical payer for cashback, and require original source linkage for eligible refund/chargeback events.
3. Wired marketplace PI platform commission to the authenticated order buyer and the stable completed-intent timestamp. GHC spending remains excluded. Verified-order recovery retries the idempotent revenue journal append and does not initiate another Pi payment.
4. Added `docs/PI-CASHBACK-SOURCE-ATTRIBUTION-AUDIT.md` to classify source paths and identify sources still not wired.
5. Added `scripts/check-pi-cashback-ledger.mjs` and registered it in `prebuild` and the network-independent static suite.
6. Updated roadmap, README, project-truth, release metadata, package/lock versions, and migration inventory to `0.157.23`.

## Verification

- Pi A2U roadmap contract: 14/14 passed.
- Pi cashback ledger contract: 22/22 passed.
- Phase 1–12 consolidation: 24/24 passed.
- Dependency lock integrity check passed.
- Migration inventory synchronized: 141 files; 98 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 40 REVIEW_REQUIRED.
- SQL inventory/contract checks are source-level only. No PostgreSQL server, Supabase connection, Pi provider, or Mainnet permissions were exercised.

## Known limitations / next gate

- The migration is not applied and remains `REVIEW_REQUIRED`.
- Only marketplace PI platform commission is wired. Membership, promotion/digital service, creator-tip commission, PI pack revenue and refund/chargeback producers need source-by-source review and wiring.
- No user-facing cashback statement API/UI, payout reservation or general-purpose A2U reward withdrawal route is implemented yet. Entitlements are not blockchain payments and must not be shown as withdrawable until funding and A2U execution gates pass.
- Existing un-attributed revenue rows are not backfilled or assigned to users. A separately reviewed evidence-based backfill would be needed to include historical activity.
- Full TypeScript, lint and Next.js production build remain unverified because dependencies are not installed in this environment and local Node.js is 22.16.0, below the project's Node.js 24.15.0 requirement.
