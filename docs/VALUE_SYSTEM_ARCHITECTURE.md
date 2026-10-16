# GreenHaven Value System Architecture

**Status:** Repository source of truth (2026-10-06)  
**Scope:** Curation · reactions · reputation · levels · XP · GHPV · monetization · GHC firewall

---

## 1. Separated concepts (do not conflate)

| Concept | What it is | Authoritative store | Client may supply? | Affects GHC? |
|---------|------------|---------------------|--------------------|--------------|
| **Social reaction** | Like / multi-type reaction on a post | `gh_reactions` via `gh_reaction_toggle` | Reaction type only | **No** |
| **Curation (GHPV)** | Structured up / down / neutral judgment | `gh_post_curations` + `gh_ghpv_active_weights` | Choice only | **No** |
| **Reputation** | Durable progression points (1–15 levels) | `gh_reputation_state` / events | Event type only after server proof | **No** |
| **Reward level / XP** | Activity presentation track (Bronze–Diamond) | Domain / UI progression | Not economic authority | **No** (display only unless ledger path used) |
| **GHPV calibration (JCS)** | Reviewer reliability signal | `gh_curator_calibration` | **Never** | **No** |
| **Curation power** | Server weight for one judgment | Derived: reputation level + JCS + integrity + maturity | **Never** | **No** |
| **Tip intent** | Intent to tip a creator | `gh_tip_intent_*` | Amount optional; settlement deferred | **Not until settlement enabled** |
| **GHC rewards / claims** | Actual coin movements | Economy RPCs / ledger | Never authoritative amounts | **Yes — only via economy RPCs** |
| **Membership VIP/VVIP** | Paid entitlement | Payment intents + entitlements | Never | Pi / spend paths only |

Doctrine: **GHC balance ≠ reputation ≠ curation power ≠ XP level.**

---

## 2. Data flow

```
USER ACTION
  ├─ Reaction  → gh_reaction_toggle → counts (no GHC, no reputation auto-award)
  ├─ Curation  → gh_post_curation_set → gh_ghpv_record_curation_weight
  │                → quality aggregates → system settlement → calibration
  │                (no GHC mint)
  ├─ Reputation events → verify → gh_reputation_apply_event → level 1–15
  │                (feeds curation power only; not wallet)
  ├─ Tip intent → createTipIntent (settlement deferred, completed:false)
  └─ GHC claim/spend/transfer → economy RPCs only
```

---

## 3. Curation power formula (server-only)

Inputs: `reputationLevel`, `judgmentCalibration` (JCS), `integrityScore`, `accountAgeDays`,
`independenceFactor`, `antiAbuseFactor`.

**Excluded:** GHC balance, tip volume, follower count, client-supplied power.

Anti-whale: max **12%** share of consensus weight per reviewer at settlement.

---

## 4. Reputation events (catalog)

| Event | Points | Client-awardable? | Proof |
|-------|--------|-------------------|-------|
| profile_complete | 25 | Yes | Server verify |
| first_post | 15 | Yes | Server verify |
| community_join | 10 | No (server path) | — |
| marketplace_order_complete | 20 | No | — |
| report_resolved_helpful | 5 | No | — |
| manual_adjustment_credit | 0 | Never | Privileged only |

Votes / curation / reactions are **not** automatic reputation events (anti-farming).

Domain `lib/domains/reputation-domain.ts` localStorage is **non-authoritative** in production UI.

---

## 5. Monetization status

| Path | Status |
|------|--------|
| Tip intent | **IMPLEMENTED** — durable intent; settlement **deferred** |
| Tip settlement → GHC credit | **INTENTIONALLY DEFERRED** / fail-closed as incomplete |
| Daily claim / activity rewards | **IMPLEMENTED** via economy reward engine + atomic stage where migrated |
| Creator quality pool / vote-to-GHC | **INTENTIONALLY DEFERRED** |
| Pi membership purchase | **IMPLEMENTED** (payment intents + entitlement) |
| Marketplace GHC spend | **IMPLEMENTED** (order total authoritative) |
| Seller settlement | **PRODUCT DECISION / not full payout rails** |

---

## 6. Anti-gaming (selected)

- One active reaction / curation row per user×content (toggle / SET semantics)
- Vote replace does not accumulate GHPV weight
- Soft-delete cleans GHPV weights; deleted content cannot settle
- Settlement system-only (`GH_SETTLEMENT_INTERNAL_KEY`)
- Settlement idempotent by content + epoch
- Self-tip forbidden
- Tip idempotency key server-forced
- Reputation points catalog server-only; client cannot set points
- Production: non-durable social writes fail closed (`STORE_UNAVAILABLE`)

---

## 7. Explicit non-goals (current phase)

- Automatic GHC from upvotes or GHPV settlement
- CQI as sole feed ranking truth
- Client-writable calibration / reputation / XP / level
- Tip completion claiming payment success

---

## 8. Related migrations

- Social reactions / curation: `20260926*`, `20260928*`
- Reputation: `20260929_gh_reputation.sql`
- GHPV: `20261013`–`20261020`
- Economy reward atomic stage: `20261011*` (separate from GHPV)
