# GreenHaven Phase 3 — Media Upload Reliability Upgrade

## Objective

Reduce avoidable media-upload failures for oversized photos while preserving the existing durable `/api/media` flow and its request-size safety margin. This phase intentionally does not introduce direct-storage credentials, resumable-upload infrastructure, or a new media database model.

## Changes

- `lib/media/upload-client.ts` now compresses image files larger than the 4 MiB proxy file ceiling in the browser before building the multipart request.
- Compression tries progressively smaller dimensions and JPEG quality levels, stopping at a 3.75 MiB target to leave multipart overhead headroom under the hosting request limit.
- The compressor releases decoded bitmap resources and revokes its fallback object URL.
- Images that remain too large return a clear direct-upload-required outcome; videos and other files are not silently transformed and still require a future direct/resumable upload path if they exceed the proxy ceiling.
- Upload progress can report “Compressing photo…” before the network upload.
- User-facing error text now explains that the photo remained too large after optimization.
- Added `scripts/test-media-upload-compression.mjs` and wired it into `ci:verify`.

## Verification performed

Passed source-level checks:
- Media upload compression: 12/12
- Feed card layout: 9/9
- Action-sheet scroll: 3/3
- Notification attention: 17/17
- Durable announcements: 15/15
- Vercel build repair: 9/9
- 10-phase baseline: 8/8
- Post composer: 16/16
- Story creator: 12/12
- Social messaging upgrade: 15/15
- Messaging reliability: 32/32
- Social authorization static scan: 38/38 routes
- IDOR static scan: 139/139

These are static/source regression checks. `npm ci --legacy-peer-deps` did not finish in the available execution window, and `node_modules/.bin/tsc` / `next` were unavailable afterward. Therefore a clean TypeScript check, lint, Next.js production build, actual browser/device upload test, and live Preview/Testnet validation remain unverified. Do not describe this package as production-certified or deployed.

## Limitations and operator gates

- Oversized photo conversion uses JPEG output, so transparency is flattened onto white and original image metadata is not preserved.
- Oversized videos and non-image files still need a separately designed and security-reviewed direct-to-storage/resumable flow.
- Test on real Pi Browser devices, including large photos, low-memory devices, network interruption, server rejection, and retry behavior.
- Keep the existing authenticated upload endpoint, server-side MIME/size checks, durable asset ownership checks, and media-reference persistence unchanged.
