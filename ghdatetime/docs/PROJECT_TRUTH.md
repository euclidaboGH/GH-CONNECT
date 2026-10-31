# GreenHaven — Project Truth

**Current source version:** `0.222.0`
**Current status:** **NOT APPROVED** for production release.

## Current authoritative metadata

- Package and lockfile version: `0.222.0`.
- Runtime: Node `24.15.0` / package engine `^24.15.0`.
- Canonical Supabase migrations: **170** SQL files.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with all 170 canonical migrations.
- No local secret `.env` file is included; `.env.example` is the only env template.

## Current source/audit status

The current source tree has passed the repository-level contracts covering release hygiene, migration manifest synchronization, regional context, section refresh, shell/realtime/scroll behavior, post/curation production behavior, wallet/notification wiring, community governance, and residual technical-debt hardening.

The corrected release archive must keep the Next.js application at repository root (`app/` directly under the repository root). Do not add an extra wrapper directory around the project.

## Release boundary

Static/source verification **does not establish** a supported-runtime production build, live Vercel behavior, applied Supabase migrations, live Pi authentication/payment/provider behavior, realtime deployment configuration, or operator approval.

Before release:
1. Use Node `24.15.x` or another supported Node 24 release.
2. Run the locked dependency install and the project's typecheck/lint/build gates.
3. Reconcile Testnet/Mainnet migration history before applying SQL.
4. Complete live/disposable Testnet and provider evidence for the relevant payment, identity, messaging, media, realtime and financial workflows.
5. Keep Mainnet changes separately approved; never infer approval from source-only checks.

## Documentation authority

Use `docs/SOURCE_OF_TRUTH.md` for prompt execution and document precedence. Old worklogs and historical phase documents are not current product authority. If a legacy verification fixture conflicts with executable source or current release documentation, the source/current release documentation wins and the fixture should be repaired rather than the product being regressed.

## Source-only evidence language

The **source migration inventory is not evidence of applied migrations**. It does NOT prove migrations are applied to any Supabase project.

The supported runtime is `^24.15.0`. **TypeScript, lint, and Next.js production build** must be executed with the supported Node 24 runtime and installed locked dependencies before production acceptance.
