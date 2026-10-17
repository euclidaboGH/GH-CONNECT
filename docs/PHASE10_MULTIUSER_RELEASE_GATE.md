# Phase 10 — Multi-user release gate

**Date:** 2026-10-17  
**Scope:** Client dual-write + hydrate for social multi-user (Phases 1–9).  
**Not claimed:** Live Supabase apply, Pi Browser E2E on device, production deployment.

---

## 1. Completion decision (source / local)

| Gate | Status |
|------|--------|
| Phase 1–9 client wiring | Done in source |
| Official assets / ledger / RLS authority | Not changed by multi-user phases |
| Fake balances / invented users | Not introduced |
| Live multi-user E2E on Testnet | **Operator** — must run with 2+ accounts |
| Production DB migrations applied | **Operator** |

**Source package decision:** `MULTIUSER_CLIENT_GATE_COMPLETE`  
**Live decision:** remains `OPERATOR_VERIFY` until the checklist below is signed off on real infrastructure.

---

## 2. What Phases 1–9 delivered (client)

| Phase | Capability |
|-------|------------|
| 1 | Feed/stories merge without durable-only gate; connect/follow → server APIs |
| 2 | Richer feed mapping; post-publish + focus revalidate |
| 3 | Reactions/comments bus; loadPostComments |
| 4 | Connection inbox list + hydrate friendRequests |
| 5 | Match signals dual-write + mutual detection + hydrate |
| 6 | Messaging create/send dual-write; loadConversationMessages |
| 7 | Profile media strip blob/data; offline profile flush; rehydrate |
| 8 | Durable notifications for connection/match; bell refresh |
| 9 | Community list hydrate; marketplace listing dual-write/hydrate |

---

## 3. Operator migrations (apply in order after review)

Do **not** invent apply success. Confirm each against live Supabase.

1. Identity / profiles (e.g. `20260919_gh_user_profiles_and_progress` if not applied)
2. Social feed / posts RPCs (existing `gh_post_*` family)
3. `20260905_connection_request_intents.sql`
4. `20261017_match_signals_durable.sql`
5. Messaging durable (`20260919_gh_messaging_durable` or current messaging migration)
6. `20261003_gh_social_notifications.sql` (+ type extensions if present)
7. Community RPCs (`gh_community_*`)
8. `202609120001_marketplace_listings_and_list_rpc.sql` (+ orders if used)

Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Pi/auth secrets, media storage for durable photos.

---

## 4. E2E multi-user checklist (two Pi KYC accounts, two devices/browsers)

Run only after migrations + auth work.

### A. Identity
- [ ] Both users complete onboarding once; returning session does not force re-fill
- [ ] Profile photo (https durable) visible after logout/login on device B

### B. Feed
- [ ] User A publishes post → User B feed shows it after refresh/focus
- [ ] User B upvotes/comments → User A sees counts on same post id (Home + Profile)

### C. Connections
- [ ] A requests connect to B → B inbox shows incoming (server durable)
- [ ] B accepts → A notified; both see connected state

### D. Match
- [ ] A likes B, B likes A → mutual match toast/notification when signal API durable
- [ ] Pass does not create match

### E. Messaging
- [ ] A starts conversation with B → B sees thread after hydrate
- [ ] Messages appear on both sides when messaging store durable

### F. Notifications
- [ ] Connection request / accept / match generate durable rows for recipient
- [ ] Bell unread updates after focus (12s poll + visibility)

### G. Communities
- [ ] A creates public community → B list shows it after hydrate
- [ ] B joins public → membership confirmed when RPC durable

### H. Marketplace
- [ ] A creates listing → dual-write success or honest “device only” toast
- [ ] B browse shows A listing when listings API durable

### I. Safety
- [ ] Blocked user content/notifications suppressed
- [ ] No client-minted GHC; wallet still server-authoritative
- [ ] IDOR: user cannot read other users’ private inbox via API with only session cookie

---

## 5. Local verification commands (operator machine)

```bash
npm ci --legacy-peer-deps
npm run check:jsx
npm run typecheck
npm run test:safety
npm run test:economy
npm run test:daily-wallet
npm run test:social-authz
npm run test:idor-static
npm run build
curl -sS "$DEPLOY_URL/api/health" | jq .
```

---

## 6. Known honest limitations

- Without Supabase migrations, dual-write paths fail soft; UI keeps device-local data and toasts “server not confirmed”.
- Match notification types reuse SQL-allowed `follow` with `metadata.kind` until enum extended in DB.
- Marketplace fee settlement still requires listing-fee payment verification when rates require it.
- This gate does **not** certify live Pi Browser concurrency or multi-region latency.

---

## 7. Release package rule

Ship this source tree with `app/` at repository root. No nested project folder. No `.env` secrets in the zip.
