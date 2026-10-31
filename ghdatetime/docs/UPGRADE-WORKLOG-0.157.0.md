# GreenHaven v0.157.0 — Phase 2 canonical identity hardening

- Source baseline: v0.156.0 Phase 1 platform foundation archive.
- Added `20261028010001_ghc_canonical_identity_state_and_race_hardening.sql`.
- Added identity lifecycle states and fail-closed resolution/ensure behavior for inactive identities.
- Serialized same-user ensure RPCs; retained unique public-ID enforcement and service-role-only RPC grants.
- Added 5-second timeouts and strict payload checks to server-side ensure/resolve calls.
- Expanded `check:phase2-identity` static contract checks.
- Updated migration inventory, release version metadata, and Phase 2 documentation.

## Verification limits

Source-level checks do not execute PostgreSQL functions or prove migration compatibility with remote schema history. No Supabase/Testnet/Mainnet database was contacted or changed. Runtime acceptance must use Node.js 24.15.0 with dependencies installed.
