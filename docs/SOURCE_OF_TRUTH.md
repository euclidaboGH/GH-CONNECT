# Current source authority — 0.338.85 (2026-11-15)

**Current working candidate:** `0.338.85`
**Current source version:** `0.338.85`
**Package identity:** `gh-connect@0.338.85` (the user-facing brand remains GREENHAVEN).
**Prior implementation:** `0.338.84` feed / home / profile / community / post-card density improvements, retained in this release.

This release enables gated upgrades delivered across the past 48 hours without flipping production-dangerous flags:

- Community posts cursor uses `undefined` under strictNullChecks while preserving Phase 4 gate regex (`String(cursor.before)`, `nextCursor: cursor`).
- FB/X-reference feed visual polish (flatter cards, stacked reaction summary, tighter rhythm) retained from 0.338.81.
- Pi Browser runtime detection expanded for UA, bridge globals, and referrer markers so auth UI does not show a hard “Couldn’t sign you in” while the SDK is still loading.
- Reserved-π incomplete withdrawal return path remains server-authorized; client CTAs and humanized errors stay visible on wallet/earnings surfaces.
- CALLS_PRODUCTION_ENABLED and REMOTE_PUSH_PRODUCTION_ENABLED stay `false` until operator infrastructure review.
- Release identity synchronized: package.json, lockfile, APP_RELEASE_VERSION, VERIFIED_MANIFEST, PROJECT_TRUTH, SOURCE_OF_TRUTH.

No new migration was added or applied. No Supabase schema/data, wallet, GHC or Pi financial state was changed. Production remains **NOT APPROVED**.

Historical documents remain for audit context; they do not override this current source authority. See `docs/UPGRADE-WORKLOG-0.338.85.md`.

Historical and legacy documents remain preserved for audit context; they do not override this current source authority.
