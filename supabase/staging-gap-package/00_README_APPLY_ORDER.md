# GreenHaven staging gap package — APPLY ORDER ONLY

**Source:** repository files under `supabase/migrations/`  
**Target:** current staging Supabase (as of audit evidence)  
**Do NOT invent objects.** Apply in numeric order.

## Already present on staging (do not re-apply blindly)

- `ghc_payment_intents` + `ghc_payment_intent_*` RPCs
- `gh_pi_identities`, `gh_sessions`, `gh_user_profiles`, `gh_user_progress`, `gh_user_achievements`
- `gh_conversations`, `gh_conversation_members`, `gh_messages`
- Matching client-deny RLS policies on those tables

## Critical path (membership)

1. `01_20260904_membership_entitlements_and_activity_caps.sql`
2. `02_20260905_p0_activity_governor_durable.sql`  
   → creates `ghc_membership_upsert` (SECURITY DEFINER, service_role only)

## GHC economy path (wallet / ledger / transfers)

3 → 17 in order (ledger → accounts → identities → transfer RPCs → daily claim → spend → stage pending → ACL / RLS lockdown)

## Marketplace path

18 → 19 (listings then orders)

## After apply

Run `VERIFY_membership_read_only.sql` (read-only).

## Notes

- Files are copies of repository migrations (not rewritten).
- Prefer Supabase SQL Editor or `supabase db push` against staging only after review.
- `schema_migrations` tracking was null on staging; after apply, prefer recording applied versions in your ops process.
