# Hardening program — 4 phases (from the 2026-11-16 source audit)

Base: `0.338.86` (Marketplace Phase 3). No version bump. Production remains **NOT APPROVED**.

## Phase 1 — Data privacy and CI coverage of the Phase 3 addresses work (DONE in source)
- Saved addresses are hard-deleted; `gh_marketplace_address_erase_user` added for erasure requests (proposal SQL only).
- `check-database-rls-coverage.mjs` and `check-security-definer-acl.mjs` now scan `supabase/proposals` as well as migrations.
- Addresses route: strict string fields (no `String()` coercion), whitelisted error codes only, `AUTH_REQUIRED` -> 401.
- Static check 29/29 and unit tests extended (strict reader, error mapping).
- Not done / not claimed: SQL not run on PostgreSQL; erase RPC not wired to account deletion (deletion is manual today); Node 24 typecheck/lint/build not run.

## Phase 2 — Auth, secrets and request protection (DONE in source)
See `docs/HARDENING-PHASE2-AUTH-SECRETS-PROGRESS.md`.

Operator keys, JWT claims, CSP, cookie CSRF, payments/approve hardening, rate-limit inventory + critical limits, secure ID helper.

## Phase 3 — Verification and supply chain (DONE in source for hardening scope)
See `docs/HARDENING-PHASE3-VERIFICATION-SUPPLY-CHAIN-PROGRESS.md`.

Behavioural money/auth contracts; Playwright job; supply-chain review; Actions tag hygiene (`@v5.0.0` / `@v7.0.0`); lint ratchet → 100; npm audit critical gate; Dependabot. Remaining ops: full SHA digests, authenticated e2e fixtures, drop legacy-peer-deps when peers allow.

## Phase 4 — Structure and release hygiene (DONE in source)
See \`docs/HARDENING-PHASE4-STRUCTURE-RELEASE-PROGRESS.md\`.

Central Supabase client (0 raw \`/rest/v1/\` under lib/); marketplace + GHC hook surface splits; image optimisation flag; archived superseded worklogs; delivery README SHA habit.
