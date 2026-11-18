# RUN321 — Phase 1 Delivery Notes

Baseline: `GREENHAVEN-0.338.99-RUN320-DEPENDENCY-SECURITY-GUARDRAILS-2026-11-17.zip`

## Implemented

- Added `lib/routing/public-route-policy.ts` with an explicit allowlist for legal/portal pages, single-segment public survey links (`/r/:slug`), and the exact public field desk (`/field`).
- Refactored `components/app-wrapper.tsx` so public pages mount outside `PiAuthProvider`, `IdentityProvider`, `SessionLockProvider`, and the authenticated app shell.
- Kept `/field/studio` and `/field/admin/**` authenticated; the policy intentionally does not whitelist `/field/**`.
- Removed the Pi SDK script and Pi-specific preconnects from `app/layout.tsx`. Authenticated app routes continue to load the official SDK through the existing on-demand `ensurePiInitialized()` runtime.
- Added token-free `auth.pi.request_received` telemetry and safe middleware diagnostics for cross-origin mutation blocks, correlated by request ID. No access tokens, raw IP addresses, or full Origin values are logged.
- Added static and executable route-policy regression tests and made them part of the prebuild gate.
- Added the four-phase recovery and upgrade plan at `docs/PHASED-RECOVERY-AND-PLATFORM-UPGRADE-PLAN-RUN321.md`.

## Verification completed

- Public-route/auth-boundary static contract: 12/12 passed.
- Executable route-policy cases: 10/10 passed.
- Run318 Pi authentication source contract: 11/11 passed.
- Field Research foundation: 23/23 passed.
- Research Intelligence foundation: 20/20 passed.
- Ecosystem 30-track coverage: 15/15 passed (42 services × 30 objectives).
- Supabase client contract: 13/13 passed.
- Dependency-security policy: 8/8 passed.
- Production safety scan: 21/21 passed.

## Not yet certified

- TypeScript, ESLint, and Next.js production build were not run: the available runtime is Node 22.16.0, the project requires Node `^24.15.0`, and dependencies are not installed in this workspace.
- Real Pi Browser sign-in, new/returning-user onboarding, public survey submission, and public field-agent submission have not been device-tested.
- The Pioneer login incident is not declared fully resolved by this route-boundary change. It remains a separate live acceptance gate because the available logs did not establish a post-deployment `/api/auth/pi` request or failure reason.
- No GitHub commit/push, Vercel deployment, Supabase migration, wallet operation, or Mainnet change was performed.
