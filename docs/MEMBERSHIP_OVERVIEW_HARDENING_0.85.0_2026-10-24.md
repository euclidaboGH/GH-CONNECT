# Membership section — overview, wiring & hardening 0.85.0

## Product model

| Tier | Role |
|------|------|
| **Free** | Default; core social features |
| **VIP / VVIP** | Paid entitlements (discovery, matching, profile, boosts, support) |

| Rail | Behaviour |
|------|-----------|
| **GHC** | Ledger spend via atomic membership purchase RPC |
| **π (Pi)** | GH Pay intent → verify → entitlement grant |

Pricing: paid months 1/4/8/12 with discounts + 1 bonus month (calendar months).  
Server status is **sole** authority for displaying paid tier (fail-closed).

## Architecture

```
PremiumMembershipScreen
├── Server status hydrate (/api/membership/status)
├── Plan cards + compare · period selector
├── Dual CTAs: Pay with π · Pay with GHC
├── Confirm / success modals
├── Recover purchase → POST /api/membership/reconcile
└── Entitlement deep-links into app tabs

APIs
├── GET  /api/membership/status
├── POST /api/membership/activate   (GHC + referral queue)
└── POST /api/membership/reconcile  (orphan recovery)
```

## Cross-feature wiring

| Feature | Link |
|---------|------|
| Wallet | GHC charge · wallet-synced after activate |
| Referral | `queueReferralReward` on VIP GHC charge |
| Rewards | Membership tier affects daily cycle amounts |
| Profile | VIP/VVIP badges |
| Discover / Matches | Entitlement-gated filters / priority |
| Notifications | Membership active system notification |
| Pi / GH Pay | Membership products |

## Hardening in 0.85.0

1. **emitMembershipActivated** — notification + wallet-synced/refresh + `ghc:membership-activated`  
2. Wired on successful **Pi** and **GHC** activation  
3. **Recover purchase** CTA → `/api/membership/reconcile` when payment may have completed without entitlement  
4. Clearer post-Pi messaging when status still free  

## Already solid (kept)

- Server-authoritative tier display  
- Dual-rail pricing + bonus months  
- Busy scoped per method (no dual spinner)  
- Offline guards · refresh before purchase  
- Atomic purchase RPC · orphan recovery API  

## Env

Pi sandbox/mainnet + Supabase service role; no special membership-only public env beyond GH Pay / economy flags already used.

## Verify

1. Status shows Free/VIP from server only  
2. GHC purchase → active + wallet refresh + notification  
3. Pi pay → poll status → active or Recover path  
4. Recover does not double-charge  
5. Insufficient GHC nudges toward wallet  

Version **0.85.0**
