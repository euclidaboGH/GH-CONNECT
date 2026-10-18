# GreenHaven full-platform review — release 0.60.4

Date: 2026-10-18
Scope: source review of the 0.60.3 package and surgical fixes for curation reward correctness. No Supabase database was contacted, and no mainnet migration was applied.

## Phase 1 — baseline and rules

- Existing economy cap is `ghc_economy_limits.max_daily_earn` (schema default 500 GHC). Curation must use that configured limit; this release removes an undocumented separate hard cap of 5 GHC.
- Existing curation is one active choice per `(post_id, user_id)` and same-choice clicks toggle the vote off. Likes remain separate.
- Existing GHPV weighting/reputation pipeline is distinct from GHC reward ledger writes. It is recorded by a separate RPC after the vote transaction and remains subject to the existing settlement rules.
- Mainnet/testnet database migration status cannot be inferred from repository files. Operator must verify each environment separately.

## Phase 2 — implemented changes

1. `ghc_curation_reward_credit` honors the configured `max_daily_earn` value and Lagos day boundaries. It retains server-derived spendable balance and reputation level, account restriction checks, wallet advisory locking, ledger credit, and unique claim per voter/post.
2. New `gh_post_curation_set_with_reward` wraps the authoritative curation mutation and reward decision in one PostgreSQL transaction. Unexpected reward evaluation errors raise and roll back the vote mutation instead of persisting a vote while silently losing the reward decision.
3. The curation API calls the wrapper and returns the reward result from the same transaction.
4. Package, lockfile and in-app release version are synchronized at 0.60.4.
5. Regression checks cover configured cap use, service-role-only RPC access, idempotency, server-derived inputs, API wiring, percentage validation and UI separation.

## Phase 3 — verification status

### Source-level checks

The repository's `scripts/test-*.mjs` suite was run locally with Node.js 22.16.0; all scripts exited successfully. These are primarily source/static contract tests. They are not proof of a successful TypeScript build, Next.js production build, or live Supabase behavior.

Focused checks passed after the changes:

- `node scripts/test-ghc-curation-reward.mjs`
- `node scripts/test-like-curation-separation.mjs`
- `node scripts/test-notification-attention.mjs`
- `node scripts/test-feed-card-layout.mjs`
- `node scripts/test-economy-v12.mjs`
- `node scripts/test-pi-payment-durable.mjs`
- `node scripts/test-social-authz.mjs`
- `node scripts/test-idor-static.mjs`
- `node scripts/test-rewards-reliability.mjs`
- `node scripts/test-messaging-reliability.mjs`

### Required release gates still outstanding

- Install dependencies using a supported Node.js release (`^22.22.2` or `^24.15.0` per `package.json`); the local runtime is 22.16.0 and `node_modules` is absent.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- Apply the migration to testnet only, inspect function grants and RLS in the target database, and exercise the combined RPC with concurrent and retry scenarios.
- Run Pi Browser end-to-end tests using at least two test accounts; validate payment, membership, reward, messaging, story, notification and profile flows.
- Verify Vercel Preview points to testnet credentials/database and Production remains isolated to mainnet.
- Do not deploy the curation migration to mainnet until the testnet results and rollback plan are approved.

## Economic-policy boundary that must not be guessed

The current code records the reward percentage for an initial reward claim, but a claim is unique per voter/post and settled immediately. That design does not yet provide a safe way to change a percentage after a claim has been settled. Downvotes currently do not credit GHC, and the GHPV/reputation pipeline does not receive the selected percentage. The requested behavior that percentage changes should affect reputation therefore needs a documented rule before it can be implemented safely. Options include: (a) percentage scales curation weight/reputation only, (b) percentage scales GHC reward only, or (c) both, with immutable past settlements and an explicitly defined future-only effect. Do not silently reverse or rewrite historical ledger entries.

## Rollback

Because the new migration has not been applied by this work session, rollback is to revert the source changes and restore the prior ZIP/branch. If testnet migration is applied later, do not drop ledger or claim history as a casual rollback; disable the wrapper/reward feature first and prepare a reviewed forward-fix or compensating-entry plan.
