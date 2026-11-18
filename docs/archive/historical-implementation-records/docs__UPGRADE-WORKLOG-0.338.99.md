# Upgrade worklog — 0.338.99 / Run 317 (2026-11-17)

## Confirmed deployment evidence

GitHub Actions run #317 (`44117254191`) for `testnet`, commit `c3bba4e67967e59b644e18e0581739d0092ef9be`, reported:
- TypeScript typecheck: passed.
- ESLint: passed.
- All 362 prebuild checks: passed.
- Next.js production build: failed with `UnhandledSchemeError` for `node:crypto`.

This is a client/server module-boundary compilation failure, not a reported TypeScript or ESLint failure in that run.

## Run 317 surgical fixes

1. Reworked `lib/secure-id.ts` to use cross-runtime Web Crypto (`globalThis.crypto`) only. UUID v4 fallback sets the RFC 4122 version and variant bits; random-byte generation is bounded; absence of secure randomness throws `SECURE_RANDOM_UNAVAILABLE` instead of downgrading to `Math.random()` or importing Node crypto.
2. Replaced dynamic `require("@/lib/secure-id")` calls in `lib/transactions.ts` and `lib/ghc-data.ts` with static imports of the browser-safe helper.
3. Moved SHA-256 push endpoint hashing from the shared `lib/notification-push-contract.ts` into `lib/server/notifications/push-hash.ts`, and retained the server-facing export through `push-architecture.ts`.
4. Updated the push contract test to exercise the server hash module separately from pure validation contracts.
5. Added `scripts/check-run317-browser-safe-crypto.mjs` and registered it in prebuild, pretypecheck, prelint and static verification.
6. Added a dedicated regression gate covering the browser/server crypto boundary, Web Crypto usage, UUID bit layout and fail-closed behavior.
7. Added seven runtime assertions for UUID format/uniqueness, prefix sanitization, secure hex lengths and byte-count bounds.
8. Registered the static gate and runtime suite in `prebuild:checks`, `pretypecheck`, `prelint` and `verify:static` so the boundary is checked before every relevant quality gate.
9. Preserved deterministic SHA-256 endpoint fingerprints and all push subscription validation semantics while moving only the Node-dependent hashing primitive.
10. Synchronized package and lockfile root versions and the in-app release identity to 0.338.99.
11. Updated the current release documentation and retained historical release snapshots without rewriting their audit history.

## Verification and limits

Verification scope for this local candidate is source-level and targeted; it is not a substitute for the full dependency-backed build.

- Run 317 browser-safe crypto boundary: 9/9.
- Run 317 Web Crypto runtime: 7/7.
- Push contract runtime tests: 19/19.
- GitHub's prior 0.338.98 run independently confirmed typecheck and lint passed before the production build failure.
- The 0.338.99 candidate still requires a fresh Node.js 24.15.0 CI typecheck/lint/build run. This environment does not contain the project dependency tree, so a full Next.js build cannot be truthfully claimed here.
- No GitHub push, Vercel deployment, Supabase mutation, migration apply, wallet/payment/payout operation, A2U enablement or Mainnet action was performed.
- Production remains NOT APPROVED pending the full supported-runtime build and operator/device acceptance.
