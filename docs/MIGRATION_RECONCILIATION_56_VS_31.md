# Migration reconciliation: 56 canonical vs 31 staging-required

**Code-only document. Do not execute SQL from this file alone.**

## Why both sets exist

| Set | Path | Role |
|-----|------|------|
| Canonical (56) | `supabase/migrations/` | Full repository history including social, reputation, media, search, additive 55–56 |
| Staging-required (31) | `supabase/staging-required-migrations/` | **Operator package**: numbered copies of migrations **actually needed** to align staging with server code paths used by wallet, membership, marketplace, social core |

Staging files are **copies** (see `00_README.md`), not alternate SQL engines.

## Staging package gaps vs full 56

Staging **excludes** (intentionally DEFER for later Testnet waves):

- Identity already live: `gh_pi_identities`, `gh_sessions`, messaging, profiles (listed as DO NOT re-apply)
- Payment intents already live
- Additive 55–56 (messaging edit/pin, post archive/quote)
- Later social: reputation, creator studio, ads, media assets, follow status, notifications, search, shares, curation
- Withdrawal requests, content attention events, connection intents proposals

## Critical ordering error in staging package

Staging numbered order currently has:

| Stage # | File | Issue |
|---------|------|--------|
| 08 | `...atomic_daily_claim...` | Applied **before** streak/population |
| 09 | `...claim_streak_and_population...` | Should be **before** atomic claim |

**Canonical correct order:**

1. `202609030001_economy_v12_claim_streak_and_population.sql`
2. `202609030002_economy_v12_atomic_daily_claim.sql`

When applying from staging package, **swap 08/09** or apply by dependency, not by stage number alone.

## Live objects — DO NOT blindly re-run

| Object | Source migration | Action |
|--------|------------------|--------|
| gh_pi_identities | 202609080002 | ALREADY LIVE |
| gh_sessions | 202609080003 | ALREADY LIVE |
| gh_user_profiles / progress / achievements | 202609190002 | ALREADY LIVE |
| gh_conversations / members / messages | 202609190001 | ALREADY LIVE |
| ghc_payment_intents + RPCs | 202609040003 | ALREADY LIVE |

## Recommended Testnet apply waves (after live-safe skip)

**Wave A — Economy core (if not present):** ledger → accounts → events → transfers → claim streak → atomic claim → spend → spend sign → wallet snapshot → stage_pending → ACL/RLS

**Wave B — Membership / activity:** membership entitlements → activity governor

**Wave C — Marketplace:** listings → orders (then later reserve RPC — not in repo yet)

**Wave D — Identity security:** step-ups, webauthn, verification (if not live)

**Wave E — Social/community core:** social_core, communities, polls, reactions, feed order, RPC ACL

**Wave F — Additive:** 55 messaging prefs, 56 post archive/quote, remaining social enhancements

## Marketplace atomic reservation

**No** `ghc_marketplace_reserve` (or equivalent) RPC exists in repository migrations.

`GH_MARKETPLACE_ATOMIC_RESERVE=1` is an **application flag only**. Enabling it without a real RPC does **not** create atomicity.

Production finite-stock orders correctly return `STOCK_RESERVATION_UNAVAILABLE` until a future migration adds atomic decrement + the flag is set.
