# GreenHaven staging — REQUIRED migrations package

**Prepared only. Do not execute from this document alone without review.**

## Purpose

Bring **staging Supabase** into alignment with database infrastructure **actually used** by the current GreenHaven application code (`lib/server`, `app/api`).

SQL files are **copies** of repository migrations under `supabase/migrations/` (not rewritten).

## Already applied on staging (DO NOT re-apply blindly)

| Objects | Source migration (repo) |
|---------|-------------------------|
| `ghc_payment_intents` + payment intent RPCs | `20260904_pi_payment_intents_durable.sql` |
| `gh_pi_identities` | `20260908_gh_pi_identities.sql` |
| `gh_sessions` | `20260908_gh_sessions.sql` |
| `gh_user_profiles`, `gh_user_progress`, `gh_user_achievements` | `20260919_gh_user_profiles_and_progress.sql` |
| `gh_conversations`, `gh_conversation_members`, `gh_messages` | `20260919_gh_messaging_durable.sql` |

If any of those objects differ from repo definitions, reconcile manually — do not assume `CREATE OR REPLACE` is safe for tables.

## Execution order (this package)

| # | File | Why included |
|---|------|----------------|
| 01–16 | Economy ledger → accounts → transfers → claim → spend → stage → ACL/RLS | Wallet, GHC membership spend, transfers, claims (`lib/server/economy/*`) |
| 17–18 | Membership entitlements + `ghc_membership_upsert` + activity governor | Pi/GHC membership grant + emission caps (`entitlement-store`, `durable-emission`) |
| 19–20 | Marketplace listings + orders | Durable marketplace (`listing-store`, `order-store`) |
| 21–23 | Step-ups, WebAuthn, verification requests | Identity security + verification stores |
| 24–27 | Social core, communities, polls | Live `app/api/social/*`, `app/api/communities/*` via `socialRpc` |

## Excluded (not in this package)

| Repo file | Reason |
|-----------|--------|
| `20260904_pi_payment_intents_durable.sql` | Already applied (objects present) |
| `20260908_gh_pi_identities.sql` / `gh_sessions.sql` | Already applied |
| `20260919_gh_messaging_durable.sql` / profiles | Already applied |
| `20260903_economy_v12_telemetry_note.sql` | Documentation/note only |
| `20260905_connection_request_intents.sql` | Connection path still primarily session; dual-write optional |
| `20260906_community_join_reasons_proposal.sql` | Explicit proposal |
| `20260907_community_governance_log_proposal.sql` | Explicit proposal / session governance |

## Safety

- Prefer backup before apply.
- Migrations use `IF NOT EXISTS` / `CREATE OR REPLACE` in many places; still review before run.
- Do not weaken RLS; service-role RPCs must stay non-public where repository revokes PUBLIC.
- Apply in numeric order `01` → `27`.
- After apply, run `../verify_staging_required_migrations.sql` (read-only).

## Not executed by this package preparation

SQL execution: NO · Deployment: NO · App code changes: NO
