# GreenHaven feature-first engineering charter

## Scope

This workstream builds and stabilizes the GH-CONNECT application source before any Supabase or Vercel verification. Do not connect to, inspect, mutate, or deploy to remote infrastructure during this workstream.

## Working baseline

- Repository package version: 0.63.25.
- Keep the existing application architecture and all useful features.
- Treat this source tree as the working project; do not replace it with a demo or a reduced scaffold.
- Keep production-sensitive financial and payout capabilities gated until their full server-side contracts and tests are proven.
- Keep secrets out of source, public environment variables, committed validation files, and generated artifacts.

## Build order

1. **Local source integrity:** confirm lockfile/package agreement, local imports, route and script references, JSX safety, release metadata, and migration inventory consistency.
2. **Application build:** install dependencies reproducibly, then pass TypeScript, lint, Next.js build, and CI checks. Fix actual failures rather than weakening checks.
3. **Feature contracts:** preserve and test identity, profile, feed/posts, comments/replies, reactions, stories/privacy, communities/groups, messaging/presence/receipts, notifications, media, marketplace, memberships, GHC utility/rewards, Pi payments, and payout adapters.
4. **Cross-feature correctness:** test session-derived identity, authorization, account isolation, idempotency, error/retry behavior, loading/empty states, mobile layouts, and accessible interactions.
5. **Database contract preparation:** review migration SQL against the app's actual query/RPC contracts and dependency order. Keep proposals and approval-required migrations out of the apply set until explicitly approved.
6. **Local acceptance:** run offline/static tests and any tests that do not require external services; clearly mark tests that require PostgreSQL, provider credentials, two live accounts, Supabase, or Vercel as not run.
7. **Infrastructure later:** only after source and feature acceptance should remote Supabase migration execution, deployed Preview/E2E, Pi Testnet, payment-provider, and release gates begin.

## Evidence rules

- A static source test is not proof of runtime behavior.
- A local build is not proof of remote deployment.
- Never claim a feature is complete solely because a migration or UI exists.
- Record each check as passed, failed, blocked, or not run, with the command and evidence.
- Do not silently delete, skip, reorder, or rename migrations to make checks pass.
- Never use production data or production payment rails for routine verification.

## Immediate next tasks

- Verify the committed package lock and runtime declarations.
- Run the available local structural and feature regression suites.
- Perform a clean dependency install and run TypeScript/lint/build if the environment permits.
- Repair real source issues while preserving features, then regenerate the project archive and a concise verification report.
