# GreenHaven 0.61.6 — Private Media and Account Lifecycle Hardening

## Included
- Added `/api/media/:id/content`, an owner-authorized delivery facade that delegates authorization to the existing signed-URL endpoint and redirects only to the configured Supabase storage origin over HTTPS.
- The delivery facade and signed media URLs are non-cacheable and avoid referrer leakage.
- Account export now paginates each explicitly allowlisted table in 1,000-row ranges. It fails closed when a source exceeds the 20,000-row per-source safety ceiling rather than silently returning a truncated export.
- Account lifecycle intake now handles malformed JSON and non-object bodies safely before validating request type and idempotency key.
- Added source regression checks and wired them into `ci:verify`.

## Critical scope boundary
This release does **not** complete private media across the whole application. The existing upload path and older database records still contain public-URL compatibility behavior, and the signed URL endpoint is owner-only. Community posts, profile photos, stories, messages, and marketplace media need an explicit visibility/access policy and a coordinated migration of upload, URL persistence, and every consumer before the bucket can be switched to private without breaking sharing. Do not enable private-bucket-only mode yet.

## Account deletion boundary
Deletion requests are step-up authenticated and durably queued; this release does not execute account deletion. A reviewed worker still needs to coordinate session revocation, storage deletion, retained financial/audit records, legal holds, retries, and operator audit events.

## Verification boundary
Source regression tests do not prove TypeScript correctness, production build, database migration application, storage bucket configuration, or deployed behavior. No live Supabase migration, storage change, Git push, or deployment was performed.
