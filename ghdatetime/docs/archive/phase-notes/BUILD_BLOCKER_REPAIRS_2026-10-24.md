# Build blocker repair — 2026-10-24

Repairs based on Vercel build output for testnet commit `0dec053`:

- Restored the backwards-compatible `resolveDisplayUrl` export as a wrapper around `resolveDisplayMediaUrl`.
- Narrowed `DurableMediaResult` on `ok` before reading `.url` in group-cover and marketplace uploads.
- Preserved visible group-cover upload errors rather than clearing them immediately after a failed upload.
- Aligned Matches screen tab state with the `MatchTabs` contract, implemented the missing inbound “Likes you” rows from current-user likes, and filtered blocked users and already-matched users.

Validation run in this workspace:

- `scripts/check-build-blocker-repairs.mjs`: 8/8
- `scripts/check-jsx-safety.mjs`: passed, 772 files scanned
- `scripts/check-release-hygiene.mjs`: 11/11
- `scripts/scan-production-safety.mjs`: 21/21

Limitations: dependency installation timed out in this workspace and the available Node runtime is v22.16.0 while the repository requires Node `^24.15.0`. Therefore no claim is made that TypeScript or the full Next.js production build passed. Re-run `npm ci --legacy-peer-deps` and `npm run build` on Node 24.15+ in CI/Vercel.
