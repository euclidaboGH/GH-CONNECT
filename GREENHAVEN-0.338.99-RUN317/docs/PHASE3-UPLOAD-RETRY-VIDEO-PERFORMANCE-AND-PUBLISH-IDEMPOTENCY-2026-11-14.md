# Phase 3 — Upload Recovery, Video Preview Performance, and Publish Idempotency

Date: 2026-11-14  
Baseline: GreenHaven / GH-CONNECT `gh-connect@0.338.67`

## Changes

- Added an in-composer recovery queue for failed photo, video, and document uploads. It retains the original `File` for the current browser session and lets the user retry one attachment without discarding text or other successfully uploaded attachments.
- Each failed attachment shows its filename, recovery message, Retry, and Remove actions. Retry is disabled during another upload or active publish. Successful retries clear their matching failure state. The queue is cleared on account change to prevent cross-account leakage.
- Video previews now use `preload="none"` in the compose media strip and story preview, and the reusable `DurableVideo` defaults to deferred loading. The resolved source remains the video element key so replacing media releases the prior element instead of keeping a stale decoder/source mounted.
- Story publishing now reuses a stable request ID while the story payload signature remains unchanged, so retrying after an uncertain response does not intentionally mint a new client-side story ID. Changing story text, media, audience, or mode resets that request identity.
- Added a focused source-contract gate and included it in `pretypecheck` and `prebuild:checks`.

## Safety boundaries

- Upload completion still requires a durable server URL. The retry queue does not make local blob/data URLs publishable.
- Retry currently retains the source `File` in memory for the current composer session. Browser reload/close recovery of the raw file is not claimed; durable post drafts continue to store only server-durable media URLs.
- Client-side stable story IDs reduce duplicate retries only if the story publishing service treats the supplied story ID as an idempotency key. This source-only increment does not prove server-side uniqueness or transaction behavior.
- No wallet, Pi payment, GHC balance, or financial settlement code was changed.

## Verification

Run the focused gates from the project root:

```sh
node scripts/check-phase3-creator-media-hardening.mjs
node scripts/check-phase3-creator-draft-recovery.mjs
node scripts/check-phase3-upload-cancellation-identity.mjs
node scripts/check-phase3-durable-media-url.mjs
node scripts/check-phase3-upload-recovery-reliability.mjs
node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/test-phase3-durable-media-url.mjs
```

Full TypeScript/build/browser/device tests remain required in the project’s supported Node 24.15+ environment. The current execution environment is Node 22 and has no installed `node_modules`, so no full build or real-device memory test is claimed.
