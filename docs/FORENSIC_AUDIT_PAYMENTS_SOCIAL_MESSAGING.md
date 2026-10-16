# GreenHaven forensic audit — payments, social, messaging, security, events

**Date:** 2026-09-09  
**Rule:** No GHC ledger changes. No invented Platform APIs. Fixes only for proven payment gaps.

---

## 1. Pi payment lifecycle (forensic)

### Happy path (as designed)

```
UI (GhPayPanel / membership)
  → ghPayPurchase (lib/gh-pay/client.ts)
  → POST /api/payments/orders (register)
  → POST /api/payments/intents  ★ durable intent (user, amount, purpose, env)
  → Pi.createPayment (SDK) with intentId in metadata
  → onReadyForServerApproval
  → POST /api/payments/approve  (amount match, bind provider id, Pi Platform approve)
  → user confirms in Pi Wallet
  → onReadyForServerCompletion + txid
  → POST /api/payments/complete (Pi complete + intent COMPLETED)
  → POST /api/payments/fulfill  (only if COMPLETED + ownership)
  → UI order status / membership unlock
```

Incomplete: `Pi.authenticate(..., onIncompletePaymentFound)` → `POST /api/payments/incomplete`.

### Intent binding fields

| Field | Present |
|-------|---------|
| GH user | `userId` |
| Pi payment ID | `providerPaymentId` after bind |
| Amount | `amount` + approve `amountsMatch` |
| Currency | `PI` (GHC rejected on intents route) |
| Purpose | `purpose` + metadata |
| Environment | **stamped in metadata.environment** (fix: always) |
| Created time | `createdAt` |
| Status machine | CREATED → … → FULFILLED / FAILED / CANCELLED |
| Fulfillment | `fulfilledAt` + fulfill route |
| Idempotency | `idempotencyKey` unique per user |

### Failure points

| # | Point | Risk | Mitigation |
|---|--------|------|------------|
| 1 | Intent create fails, client still pays | Unbound payment | **FIXED:** authenticated path aborts without intentId |
| 2 | Memory-only intents | Lost on multi-instance | Migration + service role; `assertDurableWrite` on approve |
| 3 | Amount mismatch | Fraud | approve rejects |
| 4 | User mismatch | IDOR | 403 if intent.userId ≠ auth |
| 5 | Double fulfill | Replay | status rank + FULFILLED terminal |
| 6 | Cross env sandbox/mainnet | Wrong key / 404 | **FIXED:** environment stamp + approve check |
| 7 | Missing PI_API_KEY | Approve timeout | 503 + health |
| 8 | Feature before complete | Stolen value | fulfill requires COMPLETED |
| 9 | Concurrent approve | Race | bind unique provider_payment_id |
| 10 | Incomplete abandoned | Stuck funds UX | incomplete route + recovery events |

### Proven fixes applied (this phase)

1. Authenticated `ghPayPurchase` **requires** successful intent before `createPayment`.
2. Intent metadata **`environment`**: `sandbox` | `mainnet`.
3. Approve **rejects** intent/server environment mismatch.

### Payment verification status

| Scenario | Evidence |
|----------|----------|
| Intent-before-pay (code) | Implemented |
| Env bind (code) | Implemented |
| Live Pi Browser success/fail/cancel/concurrent | **NOT VERIFIED** in this environment |
| Supabase durable write under load | **NOT VERIFIED** |

**Do not claim the payment system is fully fixed until Pi Browser + Supabase lifecycle tests pass.**

---

## 2. Social data architecture

| Domain | Classification | Notes |
|--------|----------------|-------|
| Profiles | CLIENT + local cache; partial server identity | Pi map durable; rich profile mostly client |
| Posts / comments / reactions | CLIENT ONLY (localStorage / context) | No `/api/posts` |
| Stories | CLIENT ONLY | |
| Follows / connections | CLIENT + `/api/connections/*` intents | Hybrid |
| Blocks | CLIENT | |
| Conversations / messages | CLIENT ONLY | Only `/api/messaging/premium` |
| Communities | CLIENT + governance **proposal** SQL | Not full server board |
| Reports | Hybrid governance routes | |
| Notifications | Economy notifications server; social mostly client | |
| Discovery / search | CLIENT ranking engines | |

### Gaps (no fake APIs invented)

Existing frontend expects domain adapters; **most social mutations never hit a real persistence API**.

### Smallest safe backend plan (phased — not implemented here)

1. **Profiles** — `gh_profiles` upsert by `gh_user_id` from session only  
2. **Posts** — create/list with author = session user  
3. **Connections** — already partial intents; complete accept/list  
4. **Messages** — see §3  
5. **Communities** — membership + board posts server-side  

Each phase: migration proposal → RLS → authorize mutations → wire existing domain repositories.

---

## 3. Messaging (server-authoritative target)

**Current:** Conversations/messages live in GHC context / localStorage.  
**Premium API only:** `/api/messaging/premium`.

**Required model (design only until approved):**

- Tables: `conversations`, `conversation_members`, `messages`  
- Persist message → then realtime publish  
- States: SENDING → SENT → DELIVERED → READ | FAILED  
- Idempotency key per client message  
- RLS: member-only SELECT; INSERT as self; no IDOR by UUID guess  
- Keep **DM vs community** as separate `conversation_type`  

**Not implemented in this phase** (scope + needs migration approval).

---

## 4. Security Center

**Existing building blocks:** active sessions API, passkeys panels, App Lock, step-up, block lists.  
**Gap:** unified Security Center UX + CSRF audit of all cookie mutators + redacted security event log.

**Not fully built this phase** — use existing Settings → sessions/passkeys; expand in dedicated phase.

---

## 5. Database security (summary)

| Area | Status |
|------|--------|
| `ghc_payment_intents` | RLS deny-all client; service_role RPC; SECURITY DEFINER + search_path |
| Economy tables | Migrations present; verify live policies in Supabase dashboard |
| Social tables | Mostly absent |
| Service role | Server-only via env — never `NEXT_PUBLIC_` |

**Live policy enumeration against production DB: NOT VERIFIED here.**

---

## 6. Application events

Economy has notification events; social emits mostly client-side.  
Target pipeline: **ACTION → DB tx → domain event → notification → realtime → activity → analytics**  
Only after durable commit. **Not implemented this phase.**

---

## Remediation priority

| Priority | Item |
|----------|------|
| CRITICAL | Apply payment intent migration + Supabase service role in prod |
| CRITICAL | Pi Browser lifecycle test after intent-required fix |
| HIGH | Social profile + posts server API (smallest slice) |
| HIGH | Messaging tables + RLS (separate DM / community) |
| MEDIUM | Security Center consolidation |
| MEDIUM | Unified server event bus |
| LOW | Client localStorage as pure offline cache only |

---

## Files touched this phase

- `lib/gh-pay/client.ts` — intent required when authenticated  
- `lib/server/payments/intent-store.ts` — environment stamp  
- `app/api/payments/approve/route.ts` — environment mismatch reject  
- `docs/FORENSIC_AUDIT_PAYMENTS_SOCIAL_MESSAGING.md` — this document  
