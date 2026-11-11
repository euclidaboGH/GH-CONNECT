# GreenHaven Daily Rewards UX Upgrade — 0.338.53

Date: 2026-11-11

## Scope

Premium redesign of the daily GHC claim experience across the global floating claim prompt, Feed daily reward card, Feed reward sheet, and Rewards Centre entry point.

## Experience improvements

- Replaced the crowded, compact claim popover with a responsive premium dialog and a controlled backdrop.
- Made the official GHC coin the dominant visual asset. The coin now sits in an isolated, high-contrast stage above decorative layers, with explicit visibility and stacking rules.
- Added a clearer daily reward preview, with copy that distinguishes a preview from the amount confirmed by the server.
- Added a seven-day progress journey and explicit current-day state.
- Replaced the old Feed pill with a premium daily reward card showing claim readiness, the reward preview, streak progress, maturity information, and countdown to the next Lagos reward-day reset.
- Added a matching already-claimed state with the next check-in countdown.
- Added clearer claim-success and 48-hour maturity messaging.
- Embedded the daily reward card in Rewards Centre. Its details action opens the global secure claim dialog; when today's claim is already complete, the dialog opens in an already-claimed state rather than presenting a disabled claim CTA.
- Added mobile-width handling, reduced-motion support, visible focus/disabled states, and claim-in-flight dismissal protection.

## Financial and security boundaries preserved

- Daily claims continue to use the existing authenticated `/api/economy/rewards/daily` server endpoint.
- The browser still sends an empty request body; it cannot submit the reward amount or target user.
- The server/database remains authoritative for claim eligibility, idempotency, credited amount, and ledger persistence.
- Client-side amount is labelled as a preview only; successful claim messaging uses server-reported values.
- Daily claim rewards remain pending for the existing 48-hour maturity lifecycle and are not represented as immediately spendable.
- GHC daily rewards remain separate from Pi cashback and Pi payments.
- No SQL migration, RPC, RLS policy, wallet ledger, reward schedule, reward amount, or financial feature gate was changed.

## Files changed

- `components/ghc/daily-claim-prompt.tsx`
- `components/ghc/daily-reward-experience.tsx`
- `components/ghc/rewards-centre-screen.tsx`
- `app/globals.css`
- `scripts/check-daily-reward-ux.mjs`
- `scripts/check-phase-a-daily-claim-ux.mjs`

## Verification

The following focused contracts passed:

| Check | Result |
|---|---:|
| Daily claim UX and server-boundary contract | 22/22 |
| Phase A daily reward presentation contract | 10/10 |
| Phase 8 Rewards entry contract | 18/18 |
| Phase 8 Rewards history contract | 20/20 |
| Priority 3 deep Rewards contract | 24/24 |
| Reward operator hardening | 7/7 |
| Privileged/reward request bounds | 13/13 |
| Phase 8 Rewards release gate | 15/15 |
| Phase 8 verified missions | 31/31 |
| Wallet Rewards transparency | 9/9 |
| Priority 3 Rewards + Wallet trust | 17/17 |
| Rewards/membership request guards | 10/10 |
| Phase 1–10 upgrade pack | 20/20 |

Total: **216 focused assertions passed**. JSX safety scan: **1,092 files scanned, passed**.

## Not run / release status

- Full Next.js production build, full TypeScript typecheck, ESLint, browser/device visual QA, and full static suite were not completed in this environment.
- The available Node runtime is 22.16.0, while this project requires Node 24.15.0; project dependencies are not installed in this workspace.
- No GitHub push, Vercel deployment, Supabase migration, or live financial transaction was performed.
- Treat this as a source-level UX upgrade ready for Node 24.15 CI and device acceptance, not as a deployed or production-approved release.
