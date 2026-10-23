# GREENHAVEN — PHASE 39
## Backend Final Convergence + Global Daily GHC Claim UX V2

Date: 2026-10-23

## Objective

Converge duplicated backend/client authority paths while redesigning the Daily GHC claim experience so it is global, compact, non-layout-shifting, and visually centered on the canonical GHC coin asset.

## Backend convergence

- Added `lib/server/platform/backend-authority.ts` as an executable authority registry for identity, Daily GHC issuance/redemption, wallet, social posts, curation, marketplace, messaging, notifications and media.
- Exposed the non-secret authority map through `/api/system/status` for operator diagnostics.
- Consolidated all Daily GHC status reads through `lib/rewards/claim-daily-client.ts`.
- Consolidated all Daily GHC POST claims through the same client boundary.
- Removed duplicate direct Daily Claim fetch implementations from Rewards Journey and Daily Reward Experience.
- Preserved the server/database authority model: clients send no economic amount and never optimistically credit wallet balance.
- Kept Daily issuance and pending-redemption as distinct backend responsibilities.

## Daily Claim UX V2

### Problem resolved

The previous feed-level ready notice was rendered in normal document flow. When it appeared, it pushed the feed header/content downward. This is now removed.

### New interaction model

- A compact fixed GHC claim control is rendered at the application shell level.
- It remains outside document flow and therefore cannot move the header.
- It is available across GreenHaven screens while the server reports a claimable reward.
- The trigger is a 56px circular gold/emerald GHC control rather than a large banner.
- The official GHC coin logo is used as the focal visual.
- A small live-ready indicator identifies an available claim without taking significant screen space.
- Tapping the coin opens a compact 20rem claim sheet.
- The sheet uses safe-area spacing and mobile bottom-sheet behavior.
- The user is not forced into a full-screen claim modal merely because the reward became available.
- Existing `ghc:open-daily-claim` entry points continue to work.
- Existing detailed Rewards Centre remains available.
- Existing wallet refresh/event synchronization remains intact.
- Already-claimed responses do not announce a new reward.

## Research-informed design direction

Pi Network's official documentation confirms the familiar daily check-in model: users return every 24 hours and press the lightning button to begin a new mining session. Pi also emphasizes simple, prominent interaction and continued operation without requiring the app to remain open. The redesign therefore borrows the *interaction principle* — a small, persistent, recognizable action control — rather than copying Pi's branding or artwork.

References:
- Pi FAQ: https://minepi.com/faqs/how-does-the-pi-app-work-2/
- Pi Support: https://minepi.com/support/
- Pi Browser design update: https://minepi.com/blog/pi-browser-update/

## Database

No new migration was required for Phase 39. The canonical database remains:

- 131 clean migrations
- 114 executable GreenHaven tables

## Verification

- Phase 39 backend convergence: 18/18
- Daily claim UI/media recovery: 14/14
- Daily Claim 48-hour lock: 14/14
- Daily Claim-only issuance: 31/31
- Daily Claim → Wallet pipeline: 35/35
- Phase 38 Accessibility/UX: 14/14
- Phase 37 Performance/Mobile: 18/18
- Phase 36 Security: 19/19
- Phase 35 GH Pulse/Media: 17/17
- Phase 34 Reputation/Curation: 18/18
- Project integrity: 36/36, 0 errors, 0 warnings
- Clean migrations: 131/131
- Database source contract: 114 executable tables / 131 migrations
- Migration release readiness: PASS

## Runtime boundary

The current source workspace does not contain the installed production dependency environment or live credentials required for a real Next.js build/typecheck/lint/browser E2E/live Supabase/Vercel/Pi Testnet run. Those remain explicit release gates and are not marked as passed by static checks.

## Remaining roadmap

### Phase 40 — Automated Testing + Regression Fortress
- Full contract-test matrix
- Cross-surface state synchronization tests
- Economy/payment/reward concurrency tests
- Media upload/recovery tests
- Messaging/notification deep-link tests
- Accessibility regression suite
- Mobile/Pi Browser E2E
- Build/type/lint gate convergence

### Phase 41 — Production Build + Vercel Repair
- Install Node 24 production dependency environment
- Run clean npm install
- Typecheck
- ESLint
- Next production build
- Resolve all real build failures
- Vercel environment verification
- Preview/Testnet and Production/Mainnet separation
- Deployment smoke tests

### Phase 42 — Pi Testnet E2E
- Pi authentication
- Pi identity/session lifecycle
- Wallet connection
- Pi payments
- Membership purchase → entitlement
- Marketplace checkout/payment/order lifecycle
- GHC wallet
- Daily Claim → 48h pending → redemption
- Messaging
- Media
- Notifications/deep links
- Browser/mobile validation

### Phase 43 — Global Beta Readiness
- Multi-device validation
- Low-bandwidth validation
- Abuse/security testing
- Performance budgets
- Observability
- Support/recovery procedures
- Data reconciliation
- Operator runbooks
- Beta evidence collection

### Phase 44 — Pi Ecosystem Compliance + Production Release Audit
- Ecosystem listing compliance
- Utility-first language review
- Wallet/payment UX review
- Pi SDK/backend verification
- Privacy/security review
- Final database migration reconciliation
- Production deployment evidence
- Mainnet release checklist
- Rollback readiness

### Daily Claim UX is now a permanent release requirement

Before Phase 44 release approval, verify that the Daily GHC control:

1. Never shifts the application header or content.
2. Appears consistently across the application shell.
3. Uses the canonical GHC coin asset.
4. Remains compact on small screens.
5. Respects safe areas and accessibility.
6. Does not issue GHC client-side.
7. Correctly handles repeated taps/idempotency.
8. Correctly represents the 48-hour pending state.
9. Synchronizes Wallet, Rewards, Activity and Notifications.
10. Does not conflict with other modal/sheet surfaces.
