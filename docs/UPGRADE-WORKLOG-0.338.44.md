# GreenHaven 0.338.44 — Run #279 implementation worklog

**Baseline:** User-provided 0.338.43 ecosystem candidate archive.  
**Target:** Testnet source candidate only.  
**Production:** NOT APPROVED. Mainnet untouched.

## Implemented in this increment

1. **Wallet withdrawal session isolation:** introduced a single `openPiWithdraw` entry point used by the event and Wallet action paths. It clears the previously cached withdrawable snapshot and linked Pi username before opening the sheet. A fresh authenticated, no-store server read hydrates the current session; the sheet's sticky maximum remains available only within its current open session.
2. **Wallet safety explanation:** clarified that a reservation is eligible for immediate release only when the server confirms no provider payment ID, transaction ID, execution start, lease, or attempt. Once a provider payment ID exists, release requires authoritative cancellation with no transaction or verified payment settlement. The UI cannot force-release funds.
3. **Next.js client boundaries:** moved `"use client"` directives to the first statement in Discovery Grid, Enhanced Post Card and Rewards Centre modules. This corrects a real framework directive-placement defect found by the production safety scan.
4. **Environment template hygiene:** removed the baked-in public STUN URL from `.env.example`; call transport URLs remain operator-supplied configuration and calls remain disabled until the separate call release gates are satisfied.
5. **Release truth:** synchronized package, lockfile, app release, README, project truth, source-of-truth and generated migration manifest at `0.338.44`. Historical audit fixtures are labelled as such and current release pointers updated.

## Verification completed

- Pi withdraw/consent identity contract: **12/12**.
- Wallet Phase 7 entry contract: **15/15**.
- Wallet/Rewards/Membership closeout contract: **43/43**.
- Priority 3 Rewards + Wallet trust checks: **17/17**.
- Run #278 communications regression: **31/31**.
- Ecosystem 30-track coverage: **15/15**.
- Project truth: **11/11**.
- Release hygiene: **15/15**.
- Phase 1–10 upgrade pack: **20/20**.

The verification above is source-only verification and isolated helper testing; it does not establish a dependency-backed application build. The full static suite is being reconciled separately. No full app build has been run. The supported Node.js 24.15.0 runtime is required before typecheck, lint and production build can be claimed.

## Outstanding blockers and safety boundaries

- Environment runtime is Node.js 22.16.0; project requires Node.js 24.15.0. `node_modules` is absent. Typecheck, lint and production build are therefore not claimed.
- Browser/device and two-account acceptance remain outstanding.
- Live Testnet migration history has 38 generated records. Sixteen social/call migrations still lack source files and must be restored exactly, dependency-ordered, and rehearsed before any clean-database migration sequence or push. Never replay already-applied migrations to active Testnet.
- No SQL was applied, no user or financial data was changed, no payout/provider payment was attempted, no GitHub push or Vercel deployment was initiated, and Mainnet was not accessed.
- The 41 ecosystem services and their 11 Active / 30 Coming Soon statuses remain unchanged. The 1,230 upgrade objectives are not represented as completed features; end-to-end implementation continues in subsequent increments.
