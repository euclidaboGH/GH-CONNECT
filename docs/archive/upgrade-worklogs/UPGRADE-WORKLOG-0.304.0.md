# GreenHaven v0.304.0 — Phase 18 worklog

Date: 2026-11-04

## Source baseline

This increment starts exclusively from the uploaded `GH-CONNECT-0.303.0-PHASE17-SOCIAL-ENGAGEMENT-2026-11-04.zip` baseline. It advances the release to 0.304.0 without merging earlier archives.

## Implemented

- Scoped private-media signed URL cache entries and in-flight requests to the active identity/authentication epoch.
- Invalidated cached and in-flight media resolutions when the active GreenHaven identity or authentication state changes.
- Routed dynamic user-generated image display across feed, comments, profiles, Stories, groups, discovery, messaging, marketplace, creator previews and retry surfaces through a shared private-media-aware image primitive.
- Routed post, comment, profile-library, Story and short-video playback through a session-aware video primitive while preserving video refs and native lifecycle events.
- Added session-change handling to mounted image and video surfaces so they discard prior resolved URLs and re-resolve through the authorized media facade.
- Added account privacy controls to Settings → Privacy & Safety.
- Added owner-triggered JSON export download using the existing allowlisted, owner-filtered, recent-step-up protected export endpoint.
- Added explicit deletion-request confirmation and typed `DELETE` acknowledgement using the existing idempotent lifecycle request endpoint.
- Kept deletion as a reviewed request only; no destructive deletion, balance forfeiture, payment or settlement is triggered.
- Added a Phase 18 static regression gate and registered it in `prebuild` and `verify:static`.

## Database and financial scope

No migration was added, changed or applied. No GHC, Pi, wallet, reward, payout, payment, treasury or financial-ledger logic was modified.

## Verification

- Phase 18 account privacy/private-media source contract: 18/18 passed.
- Phase 18 media-session runtime test: passed (same-viewer cache reuse, account isolation and stale in-flight response rejection).
- Consolidated static verification: pending final rerun after release metadata synchronization.
- Supported-runtime typecheck, lint, Next.js production build and browser E2E are not claimed. The available container runs Node.js 22.16.0 and has no installed `node_modules`; the project requires Node.js 24.15.0.
- No live Supabase, Pi, Vercel, Testnet or cross-account device verification is claimed.

## Release boundary

Source-only implementation and verification only. Production approval remains blocked on supported-runtime build, browser/device verification, database/provider evidence and operator release gates.
