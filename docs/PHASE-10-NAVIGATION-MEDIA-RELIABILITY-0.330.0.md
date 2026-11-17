# Phase 10.3 — Navigation and media reliability (0.330.0)

## Scope

This increment targets measured-risk fixes in the shared mobile/media helpers and reduces the initial Settings bundle by splitting infrequently visited security, compliance, Pi capability, passkey and account-data panels into lazy chunks.

## Changes

- Preserve media URLs exactly as supplied. Generic width query mutation is unsafe for signed object-storage URLs, CDN signatures and private media facade identifiers. Actual resizing must be performed by a trusted image transformation endpoint that signs the complete transformation request.
- Keep infinite-scroll request locking until the asynchronous page load settles. The prior animation-frame unlock could allow repeated scroll events to enqueue duplicate requests while the original request remained pending.
- Fall back to visible content when `IntersectionObserver` is unavailable in older embedded WebViews; add a modest prewarm root margin on supported browsers.
- Lazy-load settings subsections that are not required by the first Settings screen, with accessible section-specific loading fallbacks.
- Add runtime regression coverage for signed URL preservation and in-flight pagination locking, plus source checks for the WebView fallback and lazy boundaries.

## Safety boundaries

No API authorization, account identity, session, Pi SDK, GHC ledger, Pi payment, membership entitlement, payout, refund, treasury or database migration behavior is changed. No migration is applied and no live financial transaction is run.

## Verification limits

Run the focused runtime and source gates with Node 24.15.x, then the complete prebuild, TypeScript, ESLint and production build. Browser acceptance must include Android System WebView and Pi Browser with low-memory and constrained-network profiles. This source increment alone does not certify production readiness.
