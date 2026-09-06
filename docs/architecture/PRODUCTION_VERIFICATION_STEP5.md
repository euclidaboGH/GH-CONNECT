# Step 5 — Production verification pack

## Purpose

Close the architecture-harmonization series (Steps 1–4) with an explicit, honest production gate list.

This pack does **not** deploy, push, apply migrations, or modify secrets.

## Automated gates (run locally)

```bash
npm install --legacy-peer-deps
node scripts/verify-production-release.mjs
# or:
npm run test:release
```

Includes:

- Static safety scan (secrets surface, `use client` placement, economy constants)
- Authority map + Steps 1–4 strangler suites
- Connection / discovery / community / home OS suites
- Economy v1.2 + durable Pi payment suites

## Operator gates (must be green on your machine / infra)

| Gate | Command / action | Required for release |
|------|------------------|----------------------|
| Install | `npm install --legacy-peer-deps` | YES |
| Typecheck | `npm run typecheck` | YES |
| Lint | `npm run lint` | YES |
| Production build | `npm run build` | YES |
| Supabase migrations | Reconcile history; apply **only missing additive** migrations | YES |
| Test-Pi E2E | Pi Browser sandbox · 0.01 Test-Pi diagnostic | YES before Mainnet claims |
| Multi-instance | Two concurrent claim/spend attempts against DB | Recommended |

## Migration families (do not blind-rerun)

Already expected in repo (existence ≠ applied):

- `20260821_ghc_economy_ledger.sql`
- `20260822_*` ledger / identity / RLS / transfers
- `20260903_economy_v12_*` claim streak + atomic claim
- `20260904_pi_payment_intents_durable.sql`
- `20260904_membership_entitlements_and_activity_caps.sql`
- `20260905_connection_request_intents.sql` (**proposal / not auto-applied**)
- `20260905_p0_activity_governor_durable.sql`
- `20260906_community_join_reasons_proposal.sql` (**PROPOSAL ONLY**)
- `20260907_community_governance_log_proposal.sql` (**PROPOSAL ONLY**)

Rules:

- Additive only
- Never DROP financial tables
- Never reset balances or claim streaks
- Confirm RLS + SECURITY DEFINER search_path on financial RPCs

## Authority posture after Steps 1–4

| Domain | Class | Notes |
|--------|-------|-------|
| GHC / claims / spend | A | Server ledger + RPCs |
| Pi payments | A/B | Durable intents; server approve/complete |
| Membership entitlements | A | DB-authoritative reads/writes |
| Identity / profile read seams | B/C | Provider strangler over GHC facade |
| Feed / connections / discovery read | C + adapters | Empty production bootstrap |
| Communities membership UI | Domain-first | Local cache Studio-only |
| Verification privileged mutate | Server only | Client blocked in production |
| Governance log | C until proposal applied | Explicit non-durable metadata |

## Financial isolation

Unchanged by Steps 1–5:

- VIP = 150 GHC / 1.5 π internal reference
- VVIP = 300 GHC / 3 π internal reference
- 80/20 claim split · Curve E · global governor · 10% boost fee
- Pi and GHC remain separate rails

## Decision language

- **AUTOMATED_GATES_PASS** — code suites green; **not** “production ready”
- **OPERATOR VERIFICATION STILL REQUIRED** — typecheck, lint, build, DB, Test-Pi
- **P0/RELEASE** only after operator gates are evidenced outside this sandbox

## Safety statement

- NO DEPLOYMENT PERFORMED BY THIS PACK  
- NO GITHUB PUSH  
- NO `.env` / `.env.local` / `.git` MODIFICATION  
- NO FINANCIAL HISTORY MODIFICATION  
- NO PRODUCTION MIGRATION APPLY  
