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
| `supabase/migrations/*.sql` (canonical files on disk) | **105** |
| Latest filename in canonical inventory | `202610250007_ghc_atomic_seller_payout_settlement.sql` |
| Classification | **77 REQUIRED / 1 REQUIRES_APPROVAL / 2 PROPOSAL / 22 REVIEW_REQUIRED** |

Do **not** count `staging-required-migrations/` or `staging-gap-package/` copies as extra canonical migrations. Migration filenames are sequence identifiers, not proof of application date or live status.

The inventory is generated from `supabase/migrations/*.sql` by `scripts/generate-migration-inventory.mjs`. Run `node scripts/generate-migration-inventory.mjs --check` to detect documentation drift. See `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt`. Never bulk-apply the inventory; reconcile Testnet and Mainnet independently.

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
supabase/migrations/20261006_gh_notif_share_type.sql
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

## Phases 15–19 — Current source state

| Phase | Source state | Automated source checks | Runtime / Testnet |
|------:|--------------|-------------------------|-------------------|
| 15 | Account lifecycle, seller payout workflow, creator reward evaluation ledger and quality signals added | Phase 15 checks | Not verified here |
| 16 | Private-media account hardening, signed URL delivery and account export/deletion safeguards added | Phase 16 checks | Not verified here |
| 17 | Durable media references, viewer-aware authorization, verified Pi tip payables and PI payout reconciliation added | Phase 17 checks | Not verified here; no bucket cutover |
| 18 | Atomic GHC tip settlement and funded creator reward-pool source implementation added; GHC tip flag defaults off | Phase 19 source checks | Not verified here; concurrency suite is a required operator gate |
| 19 | Financial/media release hardening, migration-history and legacy-media preflight, operator endpoints and release inventory added | Phase 19 checks plus 123/123 repository regression scripts passed on this workspace | Full dependency install/build, Testnet, Pi E2E and live Supabase checks remain unverified |

The repository's full TypeScript, ESLint and Next production build are not claimed as passing in this workspace because the dependency install did not complete. A partial `node_modules` directory is not a valid build environment. The source-level phase tests do not replace PostgreSQL concurrency tests or external-provider evidence.

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
- Pi payout Testnet end-to-end verification and any bank/GHC external payout rails without a verified provider/treasury path  
- Blind application of `*_proposal.sql` migrations  
- Distributed (Redis/edge) rate limits  
- Introduction **send** workflow (contract may exist; sending not implemented)  

---

## Operator gates still required

1. Migration apply on **Testnet** per classification in `docs/MIGRATION_CHECKLIST.md`  
2. CI: `npm ci` → typecheck → lint → `test:safety` → build  
3. Pi Browser E2E (auth, payment, membership)  
4. Two-user IDOR + multi-instance durability  
5. Keep `NEXT_PUBLIC_MESSAGING_DURABLE=false` by default; enable only after the Testnet migration, two-user IDOR, and delivery E2E gates pass  

---

## Next step

See **docs/TESTNET_VERIFICATION_GATE.md**.

**Phases 1–13:** source-complete.  
**Phase 14:** production hardening (automated).  
**Phases 15–19:** source upgrades added; live migration, database concurrency, Pi Testnet and production verification remain outstanding.  
**Production / Mainnet:** not claimed until runtime gates pass.

---

## Source hygiene

- Literal `TODO:` / `FIXME:` markers in application TypeScript: **none found** (last scan).
- Intentional deferred/fail-closed surfaces: **`docs/DEFERRED_AND_GATED.md`**.
- Full generated migration inventory (104): **`docs/MIGRATION_CHECKLIST.md`**.

### Phase 14B — Static security (2026-10-10)

- Social authz test policy fixed (3 false positives on public/system routes)
- Static suites re-run: social-authz, IDOR, messaging, safety, GHPV, content-reward, Pi payment — pass
- Detail: `docs/PHASE_14B_STATIC_SECURITY.md`
