# Phase 4 — Identity & Authentication

**Date:** 2026-11-08  
**Baseline:** 0.330.50 (Phase 3 operator acceptance kit)  
**Release:** 0.331.0  

## Objective

Session, account and authorization integrity for GreenHaven / GH Connect.

## Implemented in this increment

1. **Concurrent session ceiling** — at most 8 active sessions per account; oldest sessions are revoked when a new session is issued (`SESSION_MAX_ACTIVE_PER_USER`, `SESSION_CAP_ENFORCED`).
2. **Session rotation after step-up** — successful Pi-verified step-up rotates the opaque session token and re-issues the HttpOnly cookie so a pre-elevation cookie cannot retain elevated context.
3. **Auth integrity helpers** — `lib/server/identity/auth-integrity.ts` provides `requireGhSession`, `requireDurableSessionStore`, and `requireAccountSecurityContext` for account-security routes.
4. **Preserved contracts** — hashed tokens only in durable store; production refuses memory-only sessions; session list requires `gh_session`; revoke-others remains step-up gated; logout clears cookie and revokes step-ups; dev `user:` tokens rejected in production.

## Explicitly out of scope (still operator / later)

- Live Supabase session table ACL drills
- Physical device WebAuthn attestation in this sandbox
- Pi Browser cookie partitioning acceptance on real hardware
- Marking Phase 4 **Verified complete** without device + durable store evidence

## Completion register (programme)

| # | Workstream | State |
|---:|---|---|
| 1 | Feed | Implemented, awaiting verification |
| 2 | Wallet & Payments | Implemented, awaiting verification |
| 3 | Rewards & Membership | Implemented, awaiting verification |
| 4 | Identity & Authentication | Implemented, awaiting verification |
| 5 | Messages & Notifications | Not started |
| 6 | Communities & Discovery | Not started |
| 7 | Marketplace | Not started |
| 8 | Profile & Matching | Not started |
| 9 | Settings & Filters | Not started |
| 10 | Platform-wide acceptance | Not started |

## Verification

```bash
node scripts/check-phase4-identity-authentication.mjs
```

Production remains **NOT APPROVED**.
