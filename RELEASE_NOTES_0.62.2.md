# GH-CONNECT v0.62.2 — Phase 22 engineering and payout reliability

## Added

- Paystack NGN bank provider adapter for Nigerian bank listing, NUBAN account resolution, transfer recipient creation, transfer initiation, signed webhook processing and provider-side reconciliation.
- Step-up protection and rate limits on user bank account operations.
- HMAC-based account fingerprinting; GreenHaven stores provider recipient code and masked bank account details, not the raw account number.
- NGN obligation ledger boundary, idempotent bank payout requests, audited operator approval/cancellation and failed/reversed transfer resolution.
- Stable transfer references, webhook deduplication, atomic UTC daily transfer caps, per-transfer limits, and late-success conflict quarantine.
- Dependency lock preflight, Phase 22 static test suite, migration preflight/assertions, and provider concurrency/failure test plan.

## Retained

- Phase 21 premium design system and responsive/accessibility improvements.
- Phase 20 Pi A2U SDK orchestration and funded atomic GHC seller settlement source.
- Existing authentication, RLS-first persistence, financial idempotency, and default-off payout flags.

## Important limitations

- `package-lock.json` remains incomplete for `pi-backend@0.1.3` because registry DNS resolution failed in the authoring environment. `npm ci` cannot pass until the lock is refreshed from a registry-connected supported Node runtime.
- TypeScript, ESLint, and production build could not complete because project dependencies are absent; only source-level tests ran.
- Migration `202610250008_paystack_ngn_beneficiaries_and_payouts.sql` is not applied to Supabase. No Paystack transfer was run because no provider credentials are available.
- Current marketplace orders are GHC/PI. They do not produce NGN obligations; no GHC/PI-to-NGN conversion is implemented. Bank payouts remain disabled until a verified NGN revenue source exists.
- Pi Testnet A2U and GHC treasury/concurrency verification remain independent production gates.

See `RELEASE_GATE_PHASE22.md` before pushing or deploying.
