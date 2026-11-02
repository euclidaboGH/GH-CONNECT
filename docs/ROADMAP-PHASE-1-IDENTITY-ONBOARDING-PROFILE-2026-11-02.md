# Roadmap Implementation — Phase 1: Identity, Onboarding and Profile

**Date:** 2026-11-02  
**Baseline:** GH-CONNECT 0.274.3 pre-GitHub audit archive  
**Status:** Source implementation and focused contract checks added; full supported-runtime validation remains required.

## Delivered in this phase

1. **Explicit identity/session status panel:** profile screen now fetches `/api/identity/me` and displays server-confirmed sign-in and Pi verification status.
2. **Account-switch safety messaging:** the panel avoids claiming that Pi identity verification equals payout authorization; account switching itself remains in the official authentication flow and is not silently initiated.
3. **Session-expiry recovery:** a 401 state tells the user to sign in again and provides a retry status action rather than leaving a blank/error screen.
4. **Profile completeness checklist:** computes progress from four existing profile fields without inventing server-side completion state.
5. **Identity-conflict handling boundary:** no client-side UID override or automatic account merge is introduced; conflict queue remains an operator capability requiring a separately authorized workflow.
6. **Personal profile data export:** new authenticated `GET /api/profile/export` exports the caller's available profile and a limited identity summary.
7. **Session revocation boundary:** not implemented in this phase because a safe all-device revocation contract and session-store capability must be confirmed before exposing a destructive control.
8. **Profile visibility preview:** offers public/member/private preview copy and explicitly states this preview does not modify actual privacy enforcement.
9. **Field-level privacy controls:** not exposed as editable toggles until profile schema and server-side visibility enforcement can be audited together; cosmetic controls would be unsafe.
10. **Identity audit trail:** no fabricated audit history is shown; durable redacted event storage requires a separately reviewed schema and retention policy.

## Security and reliability

- Export endpoint derives account ownership exclusively from the authenticated server session.
- Export is rate-limited, uncached, and excludes session secrets, Pi access tokens, internal Pi UID, wallet balances and financial records.
- Existing `/api/profile/me` and `/api/identity/me` contracts remain authoritative.
- No database migration or payout setting changed.
- A focused source-contract checker is registered at the start of `prebuild` and `verify:static`.

## Verification limits

Run `node scripts/check-roadmap-phase1-identity.mjs` for focused source-contract checks. Full `npm ci --legacy-peer-deps`, TypeScript, lint, production build, Pi Browser and deployed database tests still need to run on Node 24.15.0 with the appropriate environment. Do not treat this phase as production approval.
