# 50 Essential Upgrades — 5 Sections × 10 (0.338.15)

**Baseline:** 0.338.14  
**Production:** NOT APPROVED  
**Gate:** `scripts/check-50-essential-upgrades.mjs`

## Section 1 — Feed & Social
1. `lib/feed/essential-controls.ts` — shared public-feed exclusion policy  
2. Draft/scheduled exclusion  
3. Blocked/muted author exclusion  
4. Page size clamp  
5. Media prefetch hard bound  
6. Ranking engine imports essentials  
7. Saved lane uses exclusion helper  
8. Honest empty/error paths retained on feed screen  
9. Ranking error category detector  
10. Relationship sanitizer rejects demo/self targets  

## Section 2 — Wallet & Payments
1. `lib/wallet/essential-controls.ts`  
2. Sanitize non-finite/negative display amounts  
3. Pi atomic formatting without float drift  
4. Separate Pi/GHC rail labels  
5. Reserved/pending not spendable labels  
6. Secret-bearing wallet field detector  
7. Commission fixed 500 bps  
8. No env commission override  
9. Production Pi→GH mapping fail-closed  
10. Production remains unapproved in readiness/platform flags  

## Section 3 — Messaging & Notifications
1. `lib/messaging/essential-controls.ts`  
2. clientMessageId max 80  
3. Body max 8000  
4. Attachments max 4  
5. Offline retry max  
6. Permanent failure codes (NOT_MEMBER/BLOCKED/…)  
7. Offline flush drops permanent failures  
8. Offline flush respects retry ceiling  
9. Remote push production flag false  
10. Channel separation: in-app / browser_alert / remote_push  

## Section 4 — Marketplace & Commerce
1. `lib/marketplace/essential-controls.ts`  
2. Commission bps 500  
3. Stock availability never NaN→unlimited  
4. Quantity integer bounds  
5. Own-listing detector  
6. Cart line/qty ceilings  
7. Integrity module imports essentials  
8. Listing title/description bounds  
9. Integer commission helper  
10. Human stock error copy retained  

## Section 5 — Identity, Settings & Platform
1. `lib/platform/essential-controls.ts`  
2. PRODUCTION_APPROVED = false  
3. Node 24.15.0 pin  
4. Session max concurrent default 8  
5. Settings export expanded secret denylist  
6. Platform export helper mirrors denylist  
7. Discovery radius 1–100 km  
8. Demo/placeholder user ID rejection  
9. Five-item bottom nav contract  
10. CI never runs supabase db push  

## Explicit non-claims
No live DB, Pi Testnet payments, device a11y, or production approval.
