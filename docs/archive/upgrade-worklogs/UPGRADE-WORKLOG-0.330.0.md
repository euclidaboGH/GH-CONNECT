# GH-CONNECT 0.330.0 — Phase 10 navigation and media reliability

## Delivered source changes

- Split rarely visited Settings security, compliance, Pi capability, passkey, account-data and status panels into lazy-loaded chunks with accessible loading fallbacks.
- Removed generic `w` query parameter mutation from `optimizedImageUrl`. Signed Supabase/CDN URLs and private media facade paths must not be modified by generic browser code.
- Fixed infinite-scroll concurrency: request lock is released only after the page-load promise settles, not on the next animation frame.
- Added an IntersectionObserver compatibility fallback so content remains visible in older embedded Android/Pi WebViews.
- Added focused source and runtime regression tests and registered them in prebuild.
- Restored the missing root `.env.example` template from the immediately preceding 0.328.0 source baseline after the full static suite exposed its absence; retained the existing fail-closed defaults and E2E placeholders.
- Updated current release metadata, roadmap and source-of-truth docs.

## Focused verification performed

- Phase 10 navigation/media source gate: 9/9.
- Phase 10 navigation/media runtime tests: 7/7.
- Phase 10 Settings/performance gate: 14/14.
- Phase 10 resilience gate: 17/17.
- Phase 10 service-worker policy tests: 11/11.

The full prebuild was attempted under Node 22.16.0 and correctly stopped at the Node 24.15.x runtime gate. A complete source/static pass with only that runtime gate skipped exposed a missing `.env.example` template and a stale Phase 24 release-readiness note; both were repaired. The remaining full source/static pass must be rerun. After repairing the release-readiness note and registering the new phase document in documentation hygiene, the complete prebuild source/static chain passed when run with only the Node-runtime assertion omitted. The normal prebuild remains blocked by the actual Node 22.16.0 environment; the supported-runtime gate was not bypassed for release approval. No Node 24.15.x runtime or dependencies were available, so TypeScript, ESLint and the Next.js production build are not certified.

## Safety and acceptance

No database migration was applied. No Pi Testnet/Mainnet transaction, GHC debit, refund, payout, paid entitlement grant or treasury action was executed. Phase 9 external acceptance remains open. Phase 10 remains active. Android System WebView, Pi Browser, constrained-network, accessibility and real-device profiling are pending. Production remains NOT APPROVED.
