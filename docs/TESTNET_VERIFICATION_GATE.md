# GreenHaven — Testnet Verification Gate (Phases 1–13)

**Scope:** Prove Phases **1–13** (and related foundations) on Testnet.  
**Phase 14:** production hardening only (`docs/GH_PHASE_14.md`) — not a substitute for this Testnet gate.
**Phase 15:** not started.

Static/automated green ≠ Testnet verified ≠ production ready.

---

## 0. Pre-gate source fixes (already in tree)

| Fix | Status |
|-----|--------|
| `enhanced-post-card.tsx` Share/curation JSX | Applied |
| `profile-more-nav.tsx` NavItem structure | Applied |
| `/api/payments/complete` AUTH + INTENT + ownership | Applied |
| `/api/payments/incomplete` Pi payer binding | Applied |
| Governance auth when server mode on | Applied |

---

## 0b. Preconditions

| Item | Requirement |
|------|-------------|
| GitHub repo | Single repo for Mainnet + Testnet |
| Vercel Preview | Testnet (`NEXT_PUBLIC_PI_SANDBOX=true`) |
| Supabase | **Testnet** project for this gate |
| Env | Testnet `SUPABASE_*`, `PI_API_KEY`, `NEXT_PUBLIC_PI_CLIENT_ID` |
| Do not | Apply blindly to Mainnet; enable messaging durable flag before IDOR |

---

## 1. Migrations (Testnet only)

Canonical on-disk count: **54** under `supabase/migrations/`.

**Do not apply every file without reading classification** — see `docs/MIGRATION_CHECKLIST.md`.

| Class | Action |
|-------|--------|
| **REQUIRED** | Apply oldest → newest |
| **REQUIRES_APPROVAL** | Apply only after product/security review |
| **PROPOSAL / DO NOT APPLY** | Leave unapplied until explicitly approved |

### Proposal / do not apply by default

- `20260906_community_join_reasons_proposal.sql`
- `20260907_community_governance_log_proposal.sql`

### Requires approval

- `20260905_connection_request_intents.sql`

### Phase 1–13 social object smoke (after REQUIRED apply)

```sql
select to_regclass('public.gh_pi_identities');
select to_regclass('public.gh_sessions');
select to_regclass('public.gh_user_profiles');
select to_regclass('public.gh_posts');
select to_regclass('public.gh_content_events');
select to_regclass('public.gh_post_curations');
select to_regclass('public.gh_social_notifications');
select to_regclass('public.gh_post_shares');
select to_regclass('public.ghc_withdrawal_requests');
```

---

## 2. CI

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
```

Record **PASS / FAIL / NOT RUN** honestly. Do not mark typecheck/build passed unless commands completed successfully.

---

## 3. Two-user social E2E (Preview + Testnet DB)

| # | Test | Pass criteria |
|---|------|----------------|
| 1–3 | Reactions (incl. multi-type, toggle-off) | Persist after reload |
| 4–5 | Comment / reply | Persist |
| 6–8 | Mentions (max 5, self, nonexistent) | Correct notifications |
| 9–12 | Share (count, duplicate, deleted, blocked) | Server-authoritative |
| 13–14 | Save / follow | Durable |
| 15 | Search | Blocks / visibility respected |

### Payment invariants (Testnet)

- Unauthenticated complete → 401  
- Missing intent → rejected  
- Cross-user complete → forbidden  
- Incomplete recovery cannot bind another user’s Pi payment  

### Financial isolation

Engagement burst must not create GHC ledger / membership / tip settlement side effects.

---

## 4. Messaging gate (separate)

Confirm messaging tables, two-user IDOR, then optionally `NEXT_PUBLIC_MESSAGING_DURABLE=1`.

---

## 5. Exit criteria

| Gate | Required for “Testnet gate green” |
|------|-------------------------------------|
| REQUIRED migrations applied + objects present | Yes |
| typecheck + build | Pass |
| test:safety | Pass |
| Two-user social matrix | Pass |
| Payment ownership tests | Pass |
| Engagement ≠ financial mutation | Pass |

When exit criteria pass → **Phases 1–13 Testnet-verified** (still not automatic Mainnet / not Phase 14).

**Phase 15** product features: only after explicit design. Phase 14 hardening does not skip Testnet/IDOR/Pi E2E.
