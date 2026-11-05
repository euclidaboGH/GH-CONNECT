# GreenHaven Phase 4 — Product Experience

**Baseline:** `GREENHAVEN-0.312.0-PHASE-3-FINANCE-COMMERCE-2026-11-04.zip`  
**Date:** 4 November 2026  

## Goals

Reliable social graph display, communities “My” membership, discovery follow honesty, messaging name/photo enrichment, notification priority signal, feed soft refresh — without inventing membership or money.

## Implemented

| Area | Upgrade |
|------|---------|
| Communities membership | `isCommunityMemberDomain` / cache helpers use identity aliases |
| Communities directory seed | Owned/member rows seeded into My via `isSameIdentity` / `idListIncludes` |
| Communities hub | Joined detection uses identity aliases |
| Discovery follow | Optimistic following with **rollback** on API failure |
| Messaging inbox | Enrich DM names/photos from **following** graph as well as friends/matches |
| Notifications | Expanded priority unread types (orders, payouts, connections, security) |
| Feed | Soft section refresh when document becomes visible again |

## Not claimed

- Live Testnet membership rows for every community  
- Full realtime presence “Online now” without server flags  
- Complete ghc-context decomposition  

## Verify

```bash
node scripts/check-phase4-product-experience-2026-11-04.mjs
```
