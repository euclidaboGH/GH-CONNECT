> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.260.0 — Pass 38: Cross-domain data contract hardening

## Scope
- Hardened durable feed row normalization: finite non-negative counters, Unix-seconds and ISO timestamp normalization, and stable timestamp fallback behavior.
- Hardened marketplace price/date presentation, including negative-price rejection, seconds-based timestamps, and future listing dates.
- Bounded related-listing and community recommendation result sizes and made equal-score ordering deterministic.
- Kept presentation and normalization helpers outside payment, wallet, ledger, authorization, and persistence execution paths.

## Preservation
- No Supabase migration SQL changed; canonical inventory remains 170 SQL migrations.
- No payment, wallet, GHC/Pi balance, membership entitlement, or ledger execution logic changed.
- Canonical navigation remains Home · Messages · Communities · Cart · Profile.

## Verification boundary
Static regression checks are provided by `scripts/check-pass38-data-contracts.mjs`. A source-level pass does not establish live Supabase RLS/grants, deployed Pi provider behavior, real payment recovery, or production runtime behavior. Full typecheck/build must run under Node 24.15.x with the locked dependencies installed.
