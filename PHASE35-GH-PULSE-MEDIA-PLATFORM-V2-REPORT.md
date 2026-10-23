# GREENHAVEN — PHASE 35 GH PULSE + MEDIA PLATFORM V2

## Objective

Turn GreenHaven media and short video from a basic upload/player surface into a durable platform layer that can safely support GH Pulse, feed/profile/community/creator media, large uploads, private delivery, attention measurement, and future moderation/transcoding infrastructure.

## Major upgrades

### 1. Durable upload lifecycle
- Added `gh_media_upload_sessions` with owner, canonical storage path, MIME, category, expected size, status, attempts, expiry and finalized media ID.
- Direct upload intent now creates a short-lived server-owned upload session before issuing the storage upload URL.
- Completion requires the upload session and revalidates owner, bucket, object path and expiry.
- Completion is idempotent: retrying a finalized upload returns the same durable media ID instead of creating a second media record.
- Media IDs for direct uploads are stable across completion retries.
- Session state is deny-by-default under RLS and accessible only through service-role RPCs.

### 2. GH Pulse discovery engine
Added `gh_short_video_list` with:
- canonical viewer visibility
- block protection
- community membership protection
- stable latest/following pagination
- server-side Trending mode
- no GHC balance weighting
- no client-supplied ranking score

Trending signals are deliberately descriptive platform signals: qualified views, shares, comments and saves with recency decay. Raw likes and wallet balances are not used as ranking authority.

### 3. Attention-qualified Pulse measurement
Added server-recognized milestones:
- `view`
- `progress_25`
- `progress_50`
- `progress_75`
- `qualified_view`
- `complete`

These remain analytics/attention events only. They do not mint GHC, transfer GHC, or directly create rewards.

### 4. Video safety and device-side preparation
Added `lib/media/video-inspection.ts`:
- reads video metadata before upload
- rejects invalid metadata
- rejects videos over 40 MB
- rejects GH Pulse videos longer than 3 minutes
- rejects dimensions above 3840px
- prevents unusable/unknown video metadata from entering the durable pipeline

### 5. GH Pulse UI
The short-video surface now provides:
- Latest
- Following
- Trending
- vertical playback
- play/pause
- mute/unmute
- attention milestone tracking
- server-signal discovery labeling
- continued fail-soft loading behavior

### 6. Existing media security preserved
Phase 35 continues to use the existing private media architecture:
- session-derived ownership
- canonical owner-first storage paths
- viewer-authorized signed URLs
- five-minute signed-link lifetime
- live visibility re-evaluation
- no direct client access to media tables
- no durable `blob:` URLs

## Files added/changed

- `supabase/migrations/20261023040001_gh_pulse_media_platform_v2.sql`
- `lib/media/video-inspection.ts`
- `scripts/test-phase35-pulse-media-platform-v2.mjs`
- `PHASE35-GH-PULSE-MEDIA-PLATFORM-V2-REPORT.md`
- `lib/server/media/asset-store.ts`
- `lib/media/upload-client.ts`
- `app/api/media/direct-upload-intent/route.ts`
- `app/api/media/direct-upload-complete/route.ts`
- `app/api/social/short-video/route.ts`
- `app/api/social/posts/[id]/attention/route.ts`
- `lib/social/attention.ts`
- `lib/social/client.ts`
- `components/ghc/unified-compose.tsx`
- `components/ghc/short-video-screen.tsx`
- current migration/test contract counts and canonical installer

## Verification

- Phase 35: **17/17**
- Phase 30 marketplace regression: **17/17**
- Phase 31 messaging regression: **14/14**
- Phase 32 notification/realtime regression: **20/20**
- Phase 33 community regression: **24/24**
- Phase 34 reputation/curation regression: **18/18**
- Media direct upload: **all checks passed**
- Media signed URL: **15/15**
- Media compression: **12/12**
- Phase 6 media/messaging/realtime: **16/16**
- Project integrity: **36/36**, 0 errors, 0 warnings
- Database source contract: **112 executable GreenHaven tables / 129 clean migrations**
- Migration release readiness: **PASS (static)**

## Runtime limitation

This phase was source-verified and statically tested. The workspace does not contain installed project dependencies or production/Testnet credentials, so this report does **not** claim a successful Next.js build, TypeScript compilation, browser E2E, live Supabase migration, Vercel deployment, or Pi Testnet transaction.

The project remains pinned to Node 24. The available container runtime is not the project's pinned Node runtime, so full runtime verification remains reserved for the proper Node 24/Vercel/Testnet environment.

## Important architecture boundary

Phase 35 intentionally does not pretend to transcode or compress arbitrary video server-side. Device-side metadata validation is implemented now. Server-side transcoding, adaptive streaming, thumbnails, moderation analysis, resumable chunk storage and CDN transformation are reserved for the production media pipeline once the target storage/CDN provider and runtime workers are available.

## Remaining roadmap

36. Security, Privacy & Abuse Hardening
37. Performance + Mobile/Pi Browser Optimization
38. Accessibility + World-Class UX Consistency
39. Database & Backend Final Convergence
40. Automated Testing & Regression Fortress
41. Production Build + Vercel Repair
42. Pi Testnet E2E
43. Global Beta Readiness
44. Pi Ecosystem Compliance + Production Release Audit

Phase 36 should build directly on the Phase 35 media/upload/session contracts rather than replacing them.
