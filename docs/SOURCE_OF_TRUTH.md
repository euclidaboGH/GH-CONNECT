# Current source authority — 0.338.86 (2026-11-16)

**Current working candidate:** `0.338.86`
**Current source version:** `0.338.86`
**Package identity:** `gh-connect@0.338.86` (the user-facing brand remains GREENHAVEN).
**Prior implementation:** `0.338.84` feed / home / profile / community / post-card density improvements, retained in this release.

This release contains the Run #302 Pi A2U wallet-scope and provider-destination safety corrections:

- Community posts cursor uses `undefined` under strictNullChecks while preserving Phase 4 gate regex (`String(cursor.before)`, `nextCursor: cursor`).
- FB/X-reference feed visual polish (flatter cards, stacked reaction summary, tighter rhythm) retained from 0.338.81.
- Pi Browser runtime detection expanded for UA, bridge globals, and referrer markers so auth UI does not show a hard “Couldn’t sign you in” while the SDK is still loading.
- Reserved-π incomplete withdrawal return path remains server-authorized; client CTAs and humanized errors stay visible on wallet/earnings surfaces.
- CALLS_PRODUCTION_ENABLED and REMOTE_PUSH_PRODUCTION_ENABLED stay `false` until operator infrastructure review.
- Historical wallet-scope backfill now requires explicit user-consent provenance, a recognized address source and a valid Pi address. Provider destination adoption is bound to the current Pi identity, exact provider payment ID, Testnet network and eligible payout state.
- Migration `20261116045934_pi_wallet_scope_consent_provider_address_discovery` is applied to Supabase Testnet only. Both strict and compatibility adoption RPCs are service-role-only. Mainnet is untouched.
- No payout or ledger rows were changed. Existing UID-only authorizations remain unverified and require fresh user consent.
- Release identity synchronized: package.json, lockfile, APP_RELEASE_VERSION, VERIFIED_MANIFEST, PROJECT_TRUTH and SOURCE_OF_TRUTH. Production remains **NOT APPROVED**.

Historical documents remain for audit context; they do not override this current source authority. See `docs/UPGRADE-WORKLOG-0.338.86.md`.

Historical and legacy documents remain preserved for audit context; they do not override this current source authority.
