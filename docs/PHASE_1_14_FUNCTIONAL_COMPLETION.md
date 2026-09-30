# Phase 1–14 Final Functional Completion

## Defects fixed

### 1. Video media upload path (lib/media-pipeline.ts)
- **Defect:** Image uploads defaulted to `/api/media`; video branch still used `/media` (no route).
- **Impact:** Video durable upload failed or hit wrong path.
- **Fix:** Default both image and video to `/api/media`; updated comment.

### 2. Same-origin HTTP economy base (lib/domains/http-repositories.ts)
- **Defect:** `resolveApiBaseUrl()` returned `null` in the browser when `NEXT_PUBLIC_API_URL` was unset, so `createDomains` used **local** economy repository — client-side transfer/ledger paths instead of `POST /api/economy/transfers`.
- **Impact:** Production Vercel same-origin deployments could run non-authoritative local transfers.
- **Fix:** In browser without env override, return `"/api"` so HTTP economy paths resolve to `/api/economy/...`.
- **Also:** `req()` now always sets `credentials: "include"` for session cookies.

## Preserved
- 54 migrations unchanged
- Phase 15 not started
- A2U/staking disabled
- Tip settlement deferred
- Payment ownership / single ledger

## Tests
- Safety 21/21, Economy 173/173, Pi payment 40/40, Daily claim 35/35, JSX 576, Release 30/30
