# Upgrade worklog — 0.178.4

## Scope
Build fix: marketplace orders JSX close, RLS allowlist for cashback tables, economy env flags.

## Source-only verification
- Network/DB independent static contracts only.
- Isolated helper tests and prebuild gates; no live Supabase/Pi mutation.
- Supported runtime: **Node.js 24.15.0**.

## Changes
- Fixed marketplace `orders` branch: closed JSX expression with `)}` after order list ternary.
- Marked `gh_pi_cashback_periods` / `gh_pi_cashback_entitlements` as service-managed (RLS on, no client policies; access via service_role RPCs only).
- Documented `GHC_CURATION_REDISTRIBUTE_ENABLED` and `GHC_CREATOR_REWARD_OPERATOR_KEY` in `.env.example` as empty/0/1 placeholders.

## Limits
Does not prove Testnet apply, funded A2U, or production readiness.
