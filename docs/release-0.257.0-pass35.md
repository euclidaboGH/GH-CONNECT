> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.257.0 — Pass 35: Unified Account Experience

## Scope
Improved Settings discovery with ranked multi-word search, relevance ordering, accessible live result counts, and a one-tap clear action. Search ranks exact title relevance above subtitle and keyword matches while requiring every query token to match.

## Safety
This is a presentation/navigation improvement only. It does not change account permissions, privacy policy, notification delivery, wallet state, payment execution, or server authorization. Supabase migrations are unchanged.

## Verification
Run `node scripts/check-pass35-settings-discovery.mjs`, `node scripts/check-release-hygiene.mjs`, `node scripts/check-regional-context.mjs`, and `node scripts/check-jsx-safety.mjs`. Full production build/typecheck requires Node 24.15.0.
