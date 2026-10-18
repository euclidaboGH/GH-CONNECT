# GreenHaven reputation and curation integrity — release 0.60.6

## Implemented in source

- Added `202610180003_reputation_event_integrity.sql`: database trigger validates canonical point values for profile completion, first post, community join, marketplace completion, and helpful report events. Unknown event types and mismatched point values fail closed. Privileged manual adjustments remain explicit and positive-only.
- Added `docs/GREENHAVEN_REPUTATION_CURATION_POLICY.md` defining the separate account-reputation, GHPV judgment, and GHC ledger semantics; percentage edits; immutable credited reward policy; and required testnet acceptance tests.
- Added `scripts/test-reputation-curation-integrity.mjs` to check source wiring, SQL protections, policy boundaries, and rollout guidance.
- Added the migration to the repository inventory and testnet rollout guide.
- Synchronized package/app version to `0.60.6`.

## Important boundaries

This pass deliberately does not invent negative account-reputation points for a raw downvote or award account-reputation points merely for voting. GHPV active weight is percentage-scaled, but account progression remains based on verified reputation events. A later policy could translate settled/calibrated judgments into bounded reputation events only after rules for confidence, independent voters, appeals, collusion, and reversals are approved.

An already-posted GHC reward is immutable. A percentage change updates the active curation weight but does not reverse, claw back, or issue a second credit for the same voter/post. No historical ledger entries are rewritten.

## Verification

Run:

```bash
node scripts/test-reputation-curation-integrity.mjs
node scripts/test-ghc-curation-reward.mjs
node scripts/test-like-curation-separation.mjs
node scripts/test-ghpv-economic-safety.mjs
node scripts/scan-production-safety.mjs
node scripts/check-jsx-safety.mjs
```

These are source/static checks only. SQL execution, TypeScript, lint, Next production build, Supabase live integration, and multi-account end-to-end tests remain deployment gates. Apply to testnet only; do not push, deploy, or apply to mainnet without separate approval.
