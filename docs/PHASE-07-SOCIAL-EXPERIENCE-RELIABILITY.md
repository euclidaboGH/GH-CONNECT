> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 7 — Social experience reliability (current hardening: v0.157.6; original implementation notes retained)

## Scope

This source-only increment hardens existing feed and story flows without introducing a parallel social architecture or changing database schema.

## Changes

- Feed mute enforcement now distinguishes an authoritative empty mute list from an unavailable mute query. If the privacy-control lookup fails, the endpoint returns `503 FEED_PRIVACY_FILTER_UNAVAILABLE` rather than returning posts that may belong to muted authors.
- Story creation uses the shared bounded streaming JSON reader. The 1 MiB ceiling is enforced against bytes actually received even when `Content-Length` is missing or inaccurate, and invalid UTF-8/JSON is rejected before story fields are processed.
- Added `scripts/check-phase7-social-experience.mjs` and `npm run check:phase7-social-experience` to protect authentication, cursor bounds, canonical visibility, mute fail-closed behavior, story request bounds, URL validation, expiration bounds, public identity projection, and upstream timeouts. The current v0.157.6 hardening rejects the feed with `503 FEED_AUTHOR_ID_UNAVAILABLE` if any canonical feed row lacks an author ID, preventing malformed rows from bypassing mute filtering. The Phase 7 social contract is registered in consolidated static verification.
- Updated release metadata and project-truth notes. No database migration or production data mutation was introduced.

## Security and behavior notes

Mute filtering is treated as a privacy boundary, not a best-effort visual preference. A temporary failure may make the feed unavailable, but does not silently bypass that control. Story inline media remains constrained by the existing small compressed-image policy; external media URLs must use HTTPS. Server-side identity, audience, and expiration authority remain unchanged.

## Verification boundaries

The source-contract checker validates code structure, not runtime behavior against a live Supabase instance. No live DB, provider, or production request was executed. Browser tests, TypeScript, lint, and production build remain part of the consolidated verification after Phases 1–12, using the project's supported Node.js runtime.
