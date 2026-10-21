# GreenHaven Connect — Operator deployment guide (2026-10-21)

Phases 1–4 complete: dual-rail wallet · GHC utility · Pi→GHC packs · scale/commissions.

**Privacy rule:** only names starting with `NEXT_PUBLIC_` are public (browser). Everything else is **private** (server-only). Never put secrets or admin keys in `NEXT_PUBLIC_*`.

---

## 1. Vercel environment variables

### 1.1 Required core (Production + Preview)

| Variable | Privacy | Example / notes |
|----------|---------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** | Supabase anon key (RLS protects data) |
| `SUPABASE_URL` | **Private** | Same URL as above (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Private** | Service role — never public |
| `SUPABASE_JWT_SECRET` | **Private** | JWT secret from Supabase settings (optional if only Supabase Auth) |
| `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL` | **Public** | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_PI_CLIENT_ID` | **Public** | Pi Developer Portal OAuth client id |
| `PI_API_KEY` or `PI_SERVER_API_KEY` | **Private** | Pi Server API key |
| `PI_WALLET_PRIVATE_SEED` | **Private** | Only if A2U required; treat as highest secret |

### 1.2 Pi network mode

| Variable | Privacy | Value |
|----------|---------|--------|
| `NEXT_PUBLIC_PI_SANDBOX` | **Public** | `true` on Preview/testnet · `false` on mainnet production |
| `PI_ENV` | **Private** | `sandbox` or `production` |
| `NEXT_PUBLIC_PI_PRODUCTION_HOSTS` | **Public** | comma-separated production hostnames |

### 1.3 Testnet product unlock (Phases 1–3)

| Variable | Privacy | Recommended Preview | Production |
|----------|---------|---------------------|------------|
| `GHC_TESTNET_UNLOCK` | **Private** | `1` | unset or `0` until ready |
| `GHC_BUY_WITH_PI_ENABLED` | **Private** | `true` | `true` only when packs approved |
| `GHC_ACTIVITY_REWARDS_ENABLED` | **Private** | `1` optional | careful |
| `GHC_CURATION_REDISTRIBUTE_ENABLED` | **Private** | `1` optional | careful |
| `GHC_REFERRAL_SETTLEMENT_ENABLED` | **Private** | `0` or `1` | `0` until verified |

Do **not** require `NEXT_PUBLIC_GHC_BUY_WITH_PI` — server flags above control packs.

### 1.4 Pack acquisition caps (Phase 3)

| Variable | Privacy | Default if unset |
|----------|---------|------------------|
| `GHC_PACK_MAX_PER_DAY` | **Private** | `5` |
| `GHC_PACK_MAX_PER_WEEK` | **Private** | `15` |
| `GHC_PACK_MAX_GHC_PER_DAY` | **Private** | `1000` |

### 1.5 Marketplace fees & commission (Phases 1 + 4)

| Variable | Privacy | Example |
|----------|---------|---------|
| `GHC_MARKETPLACE_LISTING_FEE_GHC` | **Private** | `1` (testnet) |
| `GHC_MARKETPLACE_LISTING_FEE_PI` | **Private** | `0.05` |
| `GHC_MARKETPLACE_LISTING_FEE_BPS` | **Private** | `0` unless using bps of price |
| `GHC_MARKETPLACE_PLATFORM_FEE_BPS` | **Private** | `500` (= 5% of order gross) |
| `GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR` | **Private** | `0` |
| `GHC_COMMUNITY_CREATE_FEE_GHC` | **Private** | `5` testnet |
| `GHC_COMMUNITY_CREATE_FEE_PI` | **Private** | `0.1` |

### 1.6 Payouts / admin (Phase 4)

| Variable | Privacy | Value |
|----------|---------|--------|
| `GHC_ADMIN_API_KEY` | **Private** | long random (32+ chars) — header `x-ghc-admin-key` |
| `GHC_A2U_ADMIN_KEY` | **Private** | different long random |
| `GHC_SELLER_PAYOUT_HOLD_DAYS` | **Private** | `3` |
| `GHC_A2U_MAX_SINGLE_PI` | **Private** | `100` |
| `PI_A2U_ENABLED` | **Private** | `false` until ready |
| `PI_A2U_TESTNET_ONLY` | **Private** | `true` on testnet |
| `GHC_PAYOUT_RECONCILIATION_KEY` | **Private** | long random |
| `GHC_WITHDRAWALS_ENABLED` | **Private** | `false` until funded settlement |
| `GHC_WITHDRAWAL_GHC_PER_PI` | **Private** | e.g. `100` reference only |

### 1.7 Paystack (optional NGN)

| Variable | Privacy | Value |
|----------|---------|--------|
| `PAYSTACK_SECRET_KEY` | **Private** | sk_test_… / sk_live_… |
| `PAYSTACK_TRANSFERS_ENABLED` | **Private** | `false` until approved |
| `PAYSTACK_LIVE_TRANSFERS_APPROVED` | **Private** | `false` |
| `PAYSTACK_MAX_TRANSFER_KOBO` | **Private** | numeric |
| `PAYSTACK_DAILY_TRANSFER_LIMIT_KOBO` | **Private** | numeric |

### 1.8 Media / storage

| Variable | Privacy | Value |
|----------|---------|--------|
| `GH_MEDIA_BUCKET` | **Private** | private bucket name (e.g. `gh-media`) |
| Supabase Storage | Dashboard | private bucket; folders avatars, images, videos, audio, documents; 50MB |

### 1.9 Optional / advanced

| Variable | Privacy | Notes |
|----------|---------|--------|
| `GHC_SERVER_MEMORY` | **Private** | `true` only for local studio without DB |
| `GHC_ALLOW_DEV_AUTH` | **Private** | never on production |
| `GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY` | **Private** | system announcements |
| `GHC_TIPS_ENABLED` | **Private** | `false` until tip RPCs verified |
| `GHC_CREATOR_REWARD_OPERATOR_KEY` | **Private** | operator rewards |
| `WEBAUTHN_*` | mix | see `.env.example` |

### 1.10 Suggested Preview (testnet) set

```text
NEXT_PUBLIC_PI_SANDBOX=true
GHC_TESTNET_UNLOCK=1
GHC_BUY_WITH_PI_ENABLED=true
GHC_PACK_MAX_PER_DAY=5
GHC_MARKETPLACE_LISTING_FEE_GHC=1
GHC_MARKETPLACE_PLATFORM_FEE_BPS=500
GHC_SELLER_PAYOUT_HOLD_DAYS=3
GHC_A2U_MAX_SINGLE_PI=100
GHC_ADMIN_API_KEY=<generate>
GHC_A2U_ADMIN_KEY=<generate>
PI_A2U_TESTNET_ONLY=true
GHC_WITHDRAWALS_ENABLED=false
```

All of the above except `NEXT_PUBLIC_*` → **Private** in Vercel.

---

## 2. Supabase

### 2.1 Project settings

- Auth: enable providers you use (email / Pi-linked)
- API URL + anon key → `NEXT_PUBLIC_*`
- service_role → `SUPABASE_SERVICE_ROLE_KEY` only on Vercel server
- RLS: keep enabled on all `gh_*` tables

### 2.2 Storage

- Bucket private (not public read)
- Policies via `authorize_viewer` / signed URLs / `/api/media` facade
- Size limit aligned to 50MB

### 2.3 Apply migrations

Apply in **filename order** from `supabase/migrations/`. Critical recent ones for Phases 1–4:

| Migration | Purpose |
|-----------|---------|
| `202610180008_daily_claim_48h_lock.sql` | Daily claim maturity |
| `202610180009_ghc_daily_claim_only_issuance.sql` | Issuance policy |
| `202610180010_atomic_membership_purchase.sql` | Membership |
| `202610180011_atomic_marketplace_inventory_reservation.sql` | Marketplace stock |
| `202610181500_referral_programme.sql` | Referrals |
| `202610181501` / `502` | Issuance guards / curation redistribute |
| `202610190002_gh_private_media_references_and_viewer_authz.sql` | Private media |
| `202610210001_company_revenue_event_journal.sql` | Company revenue |
| `202610210001_gh_post_list_feed_curation_fields.sql` | Feed vote persistence |
| `202610210002_ghc_credit_pack_purchase.sql` | **Pi→GHC pack credit** |
| `202610210002_pi_payment_intent_idempotency_lookup.sql` | Payment intents |
| `202610210003_pi_payment_intent_atomic_transitions.sql` | Intent transitions |
| `202610250006_pi_a2u_sdk_execution_orchestration.sql` | A2U |
| `202610250007_ghc_atomic_seller_payout_settlement.sql` | Seller payout |
| `202610250008_paystack_ngn_beneficiaries_and_payouts.sql` | Paystack |

Full list: `ls supabase/migrations | sort` (~112 files). Prefer Supabase CLI:

```bash
supabase db push
# or
supabase migration up
```

---

## 3. Smoke checks after deploy

1. `GET /api/economy/health` — DB + flags  
2. `GET /api/economy/catalog?utility=1` — utility prices  
3. `GET /api/economy/purchase-ghc` — packs `enabled` + limits  
4. `GET /api/economy/scale` — Phase 4 snapshot  
5. Wallet: claim → maturity → Spend GHC → Get GHC pack intent  
6. Marketplace listing create with fee path  

---

## 4. Phase summary

| Phase | Version | Focus |
|-------|---------|--------|
| 1 | 0.65.0 | Dual-rail wallet, asset policy, fee settlement |
| 2 | 0.66.0 | GHC utility sinks, catalog/supply/utility APIs |
| 3 | 0.67.0 | Governed Pi→GHC packs, intent + fulfill credit |
| 4 | 0.68.0+ | Commission, payout eligibility, scale/admin APIs |
