# GreenHaven — Phase Implementation Status (authoritative)

**Source of truth:** working tree under this repository.  
Use this document when auditing ZIPs or planning releases.

---

## Verification vocabulary (do not collapse these)

| Label | Meaning |
|-------|---------|
| **Source implemented** | Code, migrations, and docs exist in the repo for the feature |
| **Automated tests passed** | Project scripts (safety / economy / release suites) passed in an environment that ran them |
| **Runtime / Testnet verified** | Live Supabase + Preview + multi-user / Pi Browser tests actually executed |
| **Production ready** | Runtime verified on production-like config; operator sign-off complete |

Static/automated green **does not** imply Testnet verified or production ready.

---

## Migration count

| Location | Count |
|----------|------:|
| `supabase/migrations/*.sql` (canonical files on disk) | **54** |
| Latest sequencing id | `20261005b_gh_notif_share_type.sql` |

Do **not** count `staging-required-migrations/` or `staging-gap-package/` copies as extra canonical migrations.

Migration filenames (`20260928` … `20261005b`) are **sequence identifiers**, not claims about calendar deployment dates.

See **docs/MIGRATION_CHECKLIST.md** for REQUIRED vs PROPOSAL classification. Do not apply all 54 blindly.

---

## Phases 1–13 (source)

| Phase | Topic | Source | Automated (when run) | Runtime / Testnet |
|------:|-------|--------|----------------------|-------------------|
| 1 | Durable social actions (multi-reaction, save, follow, mute, block, report) | **Implemented** | Safety suite covers isolation patterns | **Not verified here** |
| W | GHC → π withdrawal foundation | **Implemented** | Economy-related scripts when run | **Not verified here** |
| 2 | Content attention events | **Implemented** | — | **Not verified here** |
| 3 | Post curation (upvote/downvote) | **Implemented** | — | **Not verified here** |
| 4 | Reputation (15 levels, events/state) | **Implemented** | — | **Not verified here** |
| 5 | Creator Studio + tip intents (settlement deferred) | **Implemented** | — | **Not verified here** |
| 6 | Pi Ads verify fail-closed (no client reward) | **Implemented** | — | **Not verified here** |
| 7–9 | Publishing / durable media / short video | **Implemented** | — | **Not verified here** |
| 10 | Follow graph / status | **Implemented** | — | **Not verified here** |
| 11 | Durable social notifications | **Implemented** | — | **Not verified here** |
| 12 | Search & discovery foundation | **Implemented** | — | **Not verified here** |
| 13 | Shares, mentions, engagement rate limits | **Implemented** | — | **Not verified here** |

### Phase 13 checklist (source)

```
supabase/migrations/20261005_gh_post_shares.sql
supabase/migrations/20261005b_gh_notif_share_type.sql
app/api/social/posts/[id]/share/route.ts
lib/server/social/notifications.ts
lib/social/client.ts          # socialSharePost()
docs/GH_SOCIAL_ENGAGEMENT.md
```

Rate limits are **process-local** burst guards, not distributed edge quotas.

---

## Phase 14 — Production Hardening

| Field | Status |
|-------|--------|
| **Defined scope** | **`docs/GH_PHASE_14.md`** — hardening only (no new product surfaces) |
| **Source implementation** | **In progress / applied** — payment ownership static tests, legacy mock hygiene, release docs |
| **Migrations** | **None** (no Phase 14 SQL) |
| **Automated verification** | Payment durable suite includes ownership checks when run |
| **Runtime / Testnet** | **Not verified** — still operator gates |

**Not included in Phase 14:** GHC engagement rewards, tip/ad settlement, AI ranking, Curation Power monetization, Phase 15.

---

## Phase 15

| Field | Status |
|-------|--------|
| **Defined product scope** | **Not selected** — candidates only in `docs/GH_PHASE_15_PREPARATION.md` |
| **Source implementation** | **Not started** — no Phase 15 code or migrations |
| **Automated verification** | N/A |
| **Runtime / Testnet** | N/A |

**Do not invent or implement Phase 15 features** until CI + Testnet + IDOR + Pi E2E gates pass and product selects a single track.

---

## Pre-gate repairs (source, not a numbered phase)

These are maintenance/security fixes on the existing stack, **not** Phase 14/15:

| Area | Status |
|------|--------|
| `enhanced-post-card.tsx` Share/curation JSX | Source fixed |
| `profile-more-nav.tsx` NavItem structure | Source fixed |
| `/api/payments/complete` AUTH + INTENT + ownership | Source hardened |
| `/api/payments/incomplete` Pi payer binding | Source hardened |
| Governance routes auth when `GHC_GOVERNANCE_SERVER=1` | Source hardened |

---

## Financial isolation (permanent)

Engagement paths must **not** call: `ghc_execute_*`, payment complete, membership grant, withdrawal settle, tip settle, or ad reward mint as a side effect of like/comment/share/mention/save.

---

## Intentionally deferred (not Phase 14/15 by default)

- AI / For You / trending ranking  
- GHC per like/view  
- Reputation purchasable with GHC  
- Pi staking (official Platform API not confirmed)  
- Tip / ad **settlement** (intents/verification scaffolds only)  
- Blind application of `*_proposal.sql` migrations  
- Distributed (Redis/edge) rate limits  
- Introduction **send** workflow (contract may exist; sending not implemented)  

---

## Operator gates still required

1. Migration apply on **Testnet** per classification in `docs/MIGRATION_CHECKLIST.md`  
2. CI: `npm ci` → typecheck → lint → `test:safety` → build  
3. Pi Browser E2E (auth, payment, membership)  
4. Two-user IDOR + multi-instance durability  
5. `NEXT_PUBLIC_MESSAGING_DURABLE=1` only after messaging IDOR pass  

---

## Next step

See **docs/TESTNET_VERIFICATION_GATE.md**.

**Phases 1–13:** source-complete.  
**Phase 14:** production hardening (automated).  
**Phase 15:** preparation only — not implemented.  
**Production / Mainnet:** not claimed until runtime gates pass.

---

## Source hygiene

- Literal `TODO:` / `FIXME:` markers in application TypeScript: **none found** (last scan).
- Intentional deferred/fail-closed surfaces: **`docs/DEFERRED_AND_GATED.md`**.
- Full migration inventory (54): **`docs/MIGRATION_CHECKLIST.md`**.
