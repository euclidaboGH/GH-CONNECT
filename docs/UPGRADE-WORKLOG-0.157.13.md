> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Upgrade worklog — v0.157.13 — Phase 1–12 cross-system hardening

## Source baseline

- Input: `GREENHAVEN-0.157.12-PHASE12-FINAL-RELEASE-READINESS-2026-10-28.zip`.
- Output release: `0.157.13`.
- Scope: cross-phase API request-boundary hardening and release-contract coverage. No remote systems contacted and no production state changed.

## Changes

1. Applied the shared streaming `readBoundedJson` parser to account lifecycle requests (4 KiB), marketplace listing writes (12 MiB to preserve supported data-URL media payloads), social post creation (12 MiB), notification bulk-read writes (16 KiB), community creation (16 KiB), marketplace saves (8 KiB), and social comment creation (24 KiB for bounded attachment metadata).
2. Each migrated route rejects oversized bodies with HTTP 413 and malformed/non-object JSON with HTTP 400 before business logic or durable writes. Sensitive validation errors use `Cache-Control: no-store` where the route response is locally constructed; account lifecycle preserves its private no-store response wrapper.
3. Added `scripts/check-phase1-12-cross-system-hardening.mjs` and registered it in npm scripts and the consolidated static verification runner. The check covers byte-bound enforcement, parser ordering, route registrations, and current release metadata.
4. Synchronized package/lockfile root version, app release version, consolidation check, current documentation, and release manifest to `0.157.13`.
5. Preserved the existing migration files and all official GreenHaven/GHC logo assets.

## Verification

This release is based on source-level checks only; it is not production approval.

- Run the cross-system hardening check and the full static verification suite after the patch.
- Run migration inventory synchronization, release hygiene, project-truth checks, and ZIP integrity checks.
- Record exact results in the final delivery summary; do not infer production readiness from static source checks.

## Limits

The available runtime is Node.js 22.16.0, below the repository requirement Node.js 24.15.0; dependencies are not installed. TypeScript, lint, production build, browser E2E, live database migration validation, Pi Testnet, concurrency, and deployment acceptance are not established by this worklog. No live Supabase, Pi, or Vercel systems were modified.
