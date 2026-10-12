# Feed, timeline and curation review — 2026-10-11

## Implemented in this pass

- Separated the post-header options menu (author/content actions) from the engagement-row curation/feed menu. The two three-dot controls now have distinct accessible labels and independent state.
- Added a modern curation action sheet explaining that community votes affect ranking and that rewards are server-authoritative and conditional on eligibility/pool funding.
- Connected the curation menu to existing handlers when provided: feed visibility explanation, not-interested, mute-author, and report-content. Missing optional handlers remain hidden rather than presenting inert actions.
- Preserved the reward panel's existing server-backed values; this pass does not estimate, mint, or calculate GHC rewards on the client.

## Verification performed

- JSX safety scan: passed (601 files scanned).
- Production verification script: 30 automated suites passed; it explicitly leaves operator-only checks outstanding.
- Production safety scan: 21 checks passed.
- Full typecheck, lint, production build, live Supabase reconciliation, Pi Browser payment E2E, and multi-instance concurrency were not run/verified in this environment.

## Global launch gates still required

1. Install dependencies from the lockfile in a clean Node.js 20.18–24 environment, then run `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Reconcile migrations against the intended Supabase Testnet first; verify RLS and per-user ownership for every mutation and private read.
3. Test Pi authentication and payment callbacks with duplicate, delayed, invalid-signature, wrong-amount, and out-of-order events. Fulfillment must be server verified and idempotent.
4. Verify rewards and wallet accounting from database-ledger truth, including concurrent vote/reward requests, pool unfunded states, settlement and retries.
5. Test onboarding for new, returning, incomplete, and mismatched identities; ensure returning users recover their own existing profile and never receive duplicate accounts.
6. Run end-to-end tests across feed/timeline, stories/status, profiles, discovery/matches, messages, settings, membership, marketplace, and ecosystem on mobile and desktop.
7. Add production monitoring, backups/restore rehearsal, rate limits, abuse/report queues, accessibility checks, and rollback procedures.

## Security/design basis

The implementation keeps reward amounts server-authoritative and keeps optional actions conditional on actual supplied handlers. The release checklist follows OWASP guidance to authorize each request against the specific object/action, make state-changing financial operations atomic, and make payment/webhook fulfillment idempotent. See:
- https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
