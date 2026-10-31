# Referral programme — overview, wiring & hardening 0.82.0

## Product model

| Step | Behaviour |
|------|-----------|
| **Share** | Durable personal code + `/join?ref=CODE` link |
| **Capture** | `?ref=` / `?referral=` / `?invite=` stored pending until auth |
| **Attribute** | Once per referred user (code or GreenHaven ID of referrer) |
| **Queue** | 5% of qualifying VIP **GHC membership** charge → pending reward |
| **Settle** | Only when `GHC_REFERRAL_SETTLEMENT_ENABLED=1` posts to ledger |

Never invents balances in the UI. Settlement is operator-gated.

## Architecture

```
Client
├── capture-ref.ts          ?ref= → localStorage → flush after auth
├── referral/client.ts      code / status / attribute helpers
├── ReferralShareCard       Profile ecosystem + share UX
└── app boot                capture + flushPendingReferralAttribution

API
├── GET  /api/referral/code
├── GET  /api/referral/status   (0.82.0)
└── POST /api/referral/attribute

Server
├── ensureReferralCode / attributeReferral
├── queueReferralReward     (membership activate)
├── settleReferralReward    (flag-gated)
└── getReferralStatus       (0.82.0 counts)

DB (migration 20261022010084)
├── ghc_referral_codes
├── ghc_referral_attributions
└── ghc_referral_rewards
```

## Cross-feature wiring

| Feature | Connection |
|---------|------------|
| Membership activate | `queueReferralReward` after VIP GHC charge |
| Wallet / ledger | Settlement posts `earned` tx when flag on |
| Profile ecosystem | ReferralShareCard |
| Rewards centre | Explains referral path; card shows real counts |
| Notifications | Local notify on successful attribute |
| Onboarding / deep link | `?ref=` capture on app load |

## Hardening in 0.82.0

1. **GET /api/referral/status** — invited count, pending/posted reward tallies, settlement flag, attribution state  
2. **getReferralStatus** service helper (service-role reads; no client invent)  
3. **Client module** `lib/referral/client.ts`  
4. **Share card** — copy code, WhatsApp, stats grid, settlement honesty, attribute via client helper + notify  

## Env

| Variable | Privacy | Notes |
|----------|---------|--------|
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | Private | `1` to post pending rewards to ledger |
| Supabase URL + service role | Private | Required for RPCs and status |

## Verify

1. Signed-in user sees code + can copy/share  
2. Second account opens `/join?ref=CODE` → after auth attribution locks  
3. GreenHaven ID attribute once works; second attempt rejected  
4. Status shows invited count after attribution  
5. With settlement off, message explains queue-only behaviour  

Version **0.82.0**
