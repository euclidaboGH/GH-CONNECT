# Vercel prebuild failure — engagement reliability contract

The failing Vercel deployment was `dpl_AVCrBE5tT5sKCqEnnP1Hae1UrxWu`, branch `testnet`, commit `729f20a0908a2fdf5c29a27a13ad3a9330d268e0`. The prebuild suite failed at step 137/316 in `scripts/check-phase1-12-engagement-reliability.mjs` (15/16 assertions).

The failing assertion assumed `void Promise.all([ ... ])`. The current `components/ghc/notification-bell.tsx` builds a typed `requests` array, queues the unified notification write and the applicable legacy social write, then awaits `Promise.all(requests)` before dispatching `ghc:notifications-read`. The implementation was correct; the static test was stale.

Apply the separate patch `GH-CONNECT-VERCEL-PREBUILD-ENGAGEMENT-CHECK-FIX.patch` to the GitHub source at the failed deployment commit. The patch updates the assertion to verify the request-array pattern. The patched 16-check engagement reliability contract passed against the available source baseline.

This `0.338.53` RUN291 archive is an earlier source snapshot and does not contain that checker file. Do not apply the Vercel patch to this archive; apply it to the current `testnet` branch. No remote commit or deployment was performed.

The package deprecations are separate. `isomorphic-dompurify` should move to 4.x with lockfile regeneration on Node 24.15.0. The Pi SDK/Stellar dependency migration requires a controlled adapter update and Testnet verification. ESLint 10 requires a coordinated Next/plugin compatibility migration. No financial release gate was relaxed.
