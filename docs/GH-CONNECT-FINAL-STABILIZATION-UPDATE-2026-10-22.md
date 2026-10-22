# GH-CONNECT Final Stabilization Update — 2026-10-22

## Source baseline and scope

This candidate is assembled from the previously available GH-CONNECT 0.69.3 Vercel build-repair archive, with the React Hooks/static-CI patch for the reported `540b980` failures applied. It is **not** a fresh checkout of GitHub commit `540b9804c8868f5c36b6cb6628ff7c77d4ff1c06`; compare/apply the focused changes against the current `testnet` branch before replacing any branch contents.

## Changes included

- Stabilized `unfollowFromPost`, `canMessageUser`, and `applyShareResult` callback identities with appropriate dependencies.
- Corrected hook dependency arrays for the reported stale/unused dependencies and the missing state dependency.
- Updated the media signed-URL regression assertion to check the new explicit runtime validation of `ownerId`, `bucket`, and `storagePath`, including owner-prefix and path-segment checks. This avoids testing the removed, unsafe direct property expression.
- Preserved short-lived signed URLs, server-side viewer authorization, and no-store response behavior.
- Included earlier payment/economy stabilization and Vercel TypeScript repair changes already present in the base archive.

## Verification completed in this environment

- `scripts/test-latest-ci-regressions.mjs`: 16/16 passed.
- `scripts/test-media-signed-url.mjs`: 10/10 private media signed-URL checks and 5/5 upload/facade checks passed.
- `scripts/test-reported-build-regressions.mjs`: 7/7 passed.
- `scripts/test-critical-security-hardening.mjs`: 20 assertions passed.
- `scripts/test-payment-economy-stabilization.mjs`: 24/24 passed.
- `scripts/test-pi-payment-durable.mjs`: 54 passed, 0 failed.
- `scripts/test-social-authz.mjs`: 39 passed, 0 failed.
- `scripts/test-social-visibility.mjs`: 14 passed, 0 failed.
- `scripts/test-messaging-reliability.mjs`: 32 passed, 0 failed.
- Dependency lock coverage/root version check passed.
- ZIP integrity checked after packaging.

## Not verified / release blockers

- Full `npm run typecheck`, ESLint, and production `npm run build` were not completed here; the full dependency installation/build environment is not available. Do not describe this candidate as a confirmed green Vercel deployment.
- A project-integrity command was attempted but its assumed script filename was not present; no pass is claimed for that check.
- Existing duplicate migration version prefixes and future-dated migration filenames must be reconciled against actual Testnet/Mainnet migration histories before any migration is applied.
- Mission rewards and boosts remain fail-closed/paused where authoritative completion, atomic claim/activation, or downstream effects are not implemented.
- No production database writes, migrations, real Pi payments, or payouts were executed.

## Recommended next steps

1. Fetch the latest `testnet` branch and inspect `git status` before applying the focused patch.
2. Run `npm ci --legacy-peer-deps`, then the regression scripts, `npm run typecheck`, `npm run lint`, and `npm run build` on the repository's declared Node 24 runtime.
3. Fix every new compiler/lint failure rather than disabling checks.
4. Reconcile migration histories with backups/evidence before migration changes.
5. Run two-account Testnet scenarios for payment idempotency, wallet balance serialization, reward claim replay/concurrency, conversation privacy, media authorization, comment visibility, curation, and listing-fee reuse.
