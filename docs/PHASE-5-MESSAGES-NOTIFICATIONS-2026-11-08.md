# Phase 5 — Messages & Notifications

**Date:** 2026-11-08  
**Baseline:** 0.331.0 (Phase 4 Identity)  
**Release:** 0.332.0  

## Objective

Reliable private messaging, community chat entry, and account-bound notifications with honest offline behavior and safe deep links.

## Implemented in this increment

1. **Deep-link sanitization** — `sanitizeNotificationDeepLink` allows only known in-app surfaces; strips `http(s):`, `javascript:`, and oversized ids before navigation.
2. **Messaging integrity helpers** — `requireMessagingAuth`, production durable-store gate, `requireConversationMember`.
3. **Notification API cache posture** — private no-store on auth failures and mark-read paths.
4. **Preserved contracts** — dual social + unified mark-read with partial-failure honesty; offline message flush permanent-failure removal; bounded JSON on message routes; server-bound recipient ids; no client-created social notifications; clientMessageId idempotency on append.

## Still operator / device verification

- Live Web Push / VAPID on real devices  
- Cross-device session messaging under durable Supabase  
- Pi Browser notification permission UX  

## Completion register

| # | Workstream | State |
|---:|---|---|
| 1 | Feed | Implemented, awaiting verification |
| 2 | Wallet & Payments | Implemented, awaiting verification |
| 3 | Rewards & Membership | Implemented, awaiting verification |
| 4 | Identity & Authentication | Implemented, awaiting verification |
| 5 | Messages & Notifications | Implemented, awaiting verification |
| 6 | Communities & Discovery | Not started |
| 7 | Marketplace | Not started |
| 8 | Profile & Matching | Not started |
| 9 | Settings & Filters | Not started |
| 10 | Platform-wide acceptance | Not started |

Production remains **NOT APPROVED**.
