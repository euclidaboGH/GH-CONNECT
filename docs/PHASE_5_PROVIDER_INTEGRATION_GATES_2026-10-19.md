# GreenHaven Phase 5 — Provider Integration Gates

Date: 2026-10-19  
Status: source-level hardening and release-gate coverage; **not a live provider integration**.

## Scope

This pass closes a release-process blind spot: product flags can look like an integration is ready even where an authoritative provider contract has not been implemented. It adds automated source checks and includes them in `ci:verify`.

### Pi rewarded ads

- Authenticated endpoint and per-user rate limit remain required.
- `adId`, client `verified`, and client reward amount are not provider proof.
- The endpoint continues to fail closed with `ADS_VERIFY_NOT_IMPLEMENTED`; no reward is authorized.
- `GH_ADS_ENABLED=true` does not magically enable verification. Do not set it until server-side verification is implemented against the official provider contract and tested end-to-end.

### Pi ecosystem staking

- `PI_STAKING_API_ENABLED` is an operator/whitelist gate, not evidence that the API is wired.
- If enabled before the official endpoint contract and authorization are implemented, the route reports `available: false`, `reason: api_not_wired`, and `effectiveStake: null`.
- Staking is a product signal only; it must not be treated as Pi payment proof, GHC balance, or a wallet-credit authority.

## Verification

Run `npm run test:provider-feature-gates`. The test is a static source guard, not a runtime/provider integration test. It is included in `ci:verify` so future changes cannot silently convert client claims or feature flags into reward/stake authority.

## Explicitly not certified

- Pi rewarded-ad provider verification and real reward callbacks.
- Pi staking whitelist or live Platform API connectivity.
- Supabase production policy, Vercel deployment, Pi Browser device testing, or Mainnet readiness.
- Full TypeScript/lint/build checks unless run separately in an environment with installed dependencies.

## Required before enabling either provider feature

1. Confirm current official Pi API documentation and application eligibility.
2. Implement server-side authenticated provider calls with timeouts, strict response validation, and secret-only server configuration.
3. Make verification idempotent and replay-resistant using provider-issued identifiers.
4. Add mocked positive/negative/timeout/malformed-response tests and multi-account integration tests.
5. Prove no client-controlled input can authorize wallet credit or mint GHC.
6. Keep the feature disabled until operator verification and a reviewed release are complete.
