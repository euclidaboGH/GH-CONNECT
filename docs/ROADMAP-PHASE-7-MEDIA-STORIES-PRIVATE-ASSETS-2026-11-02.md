# GH-CONNECT Roadmap Phase 7 — Media, Stories & Private Assets

**Date:** 2026-11-02  
**Baseline:** Phase 6 continued archive (`0.274.3`)  
**Scope:** client-side upload resilience and private media authorization contracts.

## Implemented in this patch

1. Added a bounded network timeout to media API requests and Pi session recovery. This avoids leaving upload UI indefinitely waiting on an unresponsive request.
2. Added a longer, explicit timeout for direct storage PUT/POST uploads to accommodate larger media files.
3. Ensured timeout timers are cleared in `finally`.
4. Rejects zero-byte and invalid-sized file objects before network activity.
5. Sanitizes client-provided filenames to a bounded leaf name. This is defense-in-depth only; server-side validation remains authoritative.
6. Added a dedicated static regression checker and registered it in `prebuild` and `verify:static`.
7. Verified the existing private signed-URL route still requires an authenticated viewer, applies rate limiting, uses viewer-aware authorization, applies bounded upstream requests, and sends non-cacheable responses.

## Deliberately unchanged

- No migration or storage-bucket policy was changed.
- No authorization check was bypassed and no public-media fallback was added.
- Upload success still requires a server-confirmed durable response/finalization receipt.
- No payment, wallet, or GHC behavior was changed.

## Roadmap candidate status

This is a focused reliability patch, not completion of all ten Phase 7 candidates. Upload cancel/progress UI, publication receipts across every consumer, story audience/expiry preview, alt-text workflows, video inspection UX, durable duplicate detection, deletion lifecycle reconciliation, and retention/orphan reporting remain separate work items requiring UI/backend contract review.

## Verification boundary

Run `node scripts/check-roadmap-phase7-media-stories.mjs` for the focused source-contract checks. These checks do not replace supported-runtime TypeScript, lint, production build, live Supabase authorization tests, or Pi Browser end-to-end uploads.
