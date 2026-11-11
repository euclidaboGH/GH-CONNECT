# Upgrade worklog — 0.330.25

- Active roadmap area: Priority 3 — Rewards.
- Implemented bounded 50-row reward ledger history over the authenticated wallet endpoint using an account-bound keyset cursor ordered by exact `created_at DESC, id DESC`; added continuation metadata and stable tie-breaking for equal timestamps.
- Added account-switch history isolation and duplicate-safe page appending.
- Corrected claim feedback to distinguish server acceptance from subsequent wallet-ledger refresh.
- Exposed all seven existing server-verifiable mission codes as explicit Rewards cards with eligibility checks. Supported mission cards switch to “Achievement unlocked” only from the durable server achievement list. Unsupported marketplace-sale, community-event and referral missions are gated until durable evidence checks exist. Mission cards carry no GHC amounts; local progress and claim-ready counts remain guidance only.
- Added `scripts/check-priority3-rewards-deep-transformation.mjs` to `prebuild` and `verify:static`.
- No migrations, financial ledger entries, balances, payout requests, provider calls or payment state were changed.
- Remaining: deployed Supabase/PostgREST keyset pagination acceptance, canonical server mission snapshot/evidence/deadline contract, Testnet migration-history review, Node 24.15.x dependency-backed build checks and device/live acceptance.

## Source verification run

Passed in the current Node 22.16.0 environment:

- Priority 3 deep Rewards contract: 24/24
- Priority 3 Rewards + Wallet trust contract: 17/17
- Rewards entry contract: 18/18
- Rewards history contract: 20/20
- Rewards source release gate: 15/15
- Verified missions contract: 31/31
- Wallet Rewards transparency: 9/9
- Daily reward UX: 21/21
- Reward/payment contract: 10/10
- Wallet/rewards separation: 13/13
- Pi cashback ledger: 23/23
- Phase 1 truth honesty: 13/13
- Build type-regression guard: 7/7
- Repository consistency: 6/6
- Project truth: 10/10
- Migration source manifest: 191/191
- Documentation hygiene: PASS
- JSX safety: 978 files scanned, OK
- Production safety scan: 21 PASS, 0 FAIL

The repository requires Node 24.15.0 (`.nvmrc`, `package.json` engine), while this environment has Node 22.16.0 and no `node_modules`. Dependency-backed `npm ci`, typecheck, lint and Next.js build were not run. Browser/Android/Pi Browser, live Testnet and remote migration-history acceptance were not run. These remain open; production is NOT APPROVED.
