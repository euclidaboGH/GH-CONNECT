> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.258.0 — Pass 36: System Integrity & Release Truth

## Why this pass matters
A system-wide source audit found that the package and application release had advanced while README, Project Truth, and the verified source manifest still identified older releases. The project-truth check existed but was not part of the production prebuild chain. That made release documentation drift possible without blocking a build.

## Improvements
- Synchronized package, lockfile, in-app release metadata, README, Project Truth, and verified migration inventory to 0.258.0.
- Added a dedicated system-integrity gate covering release metadata, migration inventory count, runtime pin, canonical navigation contract, and explicit production approval boundaries.
- Wired both the project-truth regression check and the new system-integrity gate into `prebuild`, so stale release truth blocks production builds.
- Regenerated the deterministic migration inventory; all 170 canonical SQL migration files remain unchanged.

## Audit evidence
The source audit re-ran the following contracts successfully: release hygiene, regional context, JSX safety, migration source manifest, security headers, SECURITY DEFINER source ACL patterns, database RLS coverage, API CSRF, payment-intent hardening, media API hardening, transfer-request hardening, rate-limiter memory bounds, build/type regression guards, and dependency-lock integrity.

## Verification boundary
Static checks are source evidence only. They do not establish deployed database grants/RLS, applied migrations, live Pi provider behavior, live Vercel behavior, or production readiness. Full TypeScript/lint/Next.js build remains unverified in this environment because Node 22.16.0 is available while the project requires Node 24.15.0 and installed locked dependencies.

## Safety
No Supabase migration SQL was changed. No wallet, payment, ledger, authorization, identity, or reward execution behavior was changed. Canonical navigation remains Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.
