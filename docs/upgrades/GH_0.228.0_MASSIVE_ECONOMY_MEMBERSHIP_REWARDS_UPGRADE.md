> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.228.0 — Massive Economy, Membership & Rewards Upgrade

## Goal
Make Wallet, GHC, Pi, Membership and Rewards feel like one coherent, trustworthy product journey while preserving strict asset separation and server authority.

## Product upgrades
- Added a Wallet **Money & benefits** command centre connecting balances to Rewards and Membership without mixing GHC and Pi ledgers.
- Added a Rewards **Best next action** layer so the centre interprets verified progress instead of presenting only dashboards and statistics.
- Added a Membership **Membership path** decision helper that explains when Free, VIP or VVIP is appropriate without pay-to-win pressure.
- Hardened membership presentation so paid active state in the status/current-plan surfaces comes from the authoritative membership endpoint rather than local cache.
- Preserved payment recovery, authoritative wallet reads, pending/locked balance semantics, Daily Claim maturity, Pi/GHC separation, referrals, achievements and challenge validation.

## Product principles
- No guaranteed income, investment or appreciation claims.
- Membership does not buy verification, reputation or guaranteed rewards.
- GHC and Pi remain distinct rails.
- Financial actions remain server-authoritative.
- UI should answer: **What do I have? What is its status? What can I do next?**
