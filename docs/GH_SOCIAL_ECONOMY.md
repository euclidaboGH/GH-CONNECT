# GH Social Economy — Product & Architecture Specification

**Status:** Approved direction (implementation phased)  
**Product:** GreenHaven  
**Not a Steemit clone.** Influence is not purchased with GHC balance.

---

## Layers

1. **GH Content** — posts, media, stories, polls, community, short video (GH Pulse)
2. **GH Attention** — qualified views, completion, saves (not raw clicks)
3. **GH Curation** — reactions + upvote/downvote weighted by Curation Power
4. **GH Reputation** — multi-dimension scores → **15 levels**
5. **GH Creator Value** — tips, governed creator rewards, Creator Studio
6. **GH Ads** — Pi Ad Network with **server-verified** adId only

---

## Non-negotiable rules

| Allowed | Forbidden |
|---------|-----------|
| Server-authoritative grants | Client-minted GHC |
| Reward verified meaningful participation | GHC per view / per like |
| Curation Power from reputation & integrity | Vote power = wallet balance |
| Separate reward streams A/B/C | Merged ad + creator + engagement ledgers |
| Pi for payments & ads | Treating GHC as external crypto |

### Reward streams (never merge)

- **A. Creator earnings** — quality + programs  
- **B. Engagement rewards** — governed caps / cooldowns  
- **C. Ad rewards** — only after Pi server verification of rewarded ad  

---

## Reputation — 15 levels

| L | Name | Notes |
|--:|------|--------|
| 1 | Seed | New account |
| 2 | Sprout | First durable activity |
| 3 | Root | Identity + consistency |
| 4 | Branch | Regular participation |
| 5 | Canopy | Reliable community presence |
| 6 | Grove | Early curation trust |
| **7** | **Haven** | **Sustainability gate** |
| 8 | Steward | Strong curator/community |
| 9 | Artisan | Recognized creator quality |
| 10 | Mentor | Educational value |
| 11 | Beacon | Reach without abuse |
| 12 | Pillar | High multi-dimension trust |
| 13 | Architect | Sustained excellence |
| 14 | Guardian | Elite integrity |
| 15 | Legend | Rare long-horizon status |

### Level 7 (Haven)

Not free money. Large creator reward pools and higher program limits open only when platform **real revenue rails** (Pi, membership, marketplace, approved ads) are operational. Funded by real income, not inflation.

Progression inputs: account age, verification, quality outcomes, curation accuracy, community health, commerce reliability, low abuse rate.  
**Excluded:** GHC balance, purchased rank, reciprocal rings.

---

## Curation

- **Reactions** (like, love, support, inspire, insight, celebrate, …): social signal  
- **Upvote / Downvote** (later phase): distribution boost / dampener via Curation Power  
- Downvotes do **not** equal “destroy score”; combined with quality & moderation signals  

---

## Pi Ads

```text
Pi Browser → Ads SDK → GH Ads Adapter → session/adId
  → GH server → Pi verify → gh_ad_events → reward engine (if eligible)
```

Never: client `AD_REWARDED` → immediate GHC.

---

## Implementation phases

0. DB migrations / ACL / build green  
1. Durable multi-reaction + social actions  
2. Attention events + quality signals  
3. Upvote/downvote + Curation Power  
4. 15-level reputation snapshots  
5. Tips + creator programs + Studio  
6. Pi Ads verify path  

Code modules:

- `lib/social/reactions.ts` — allowlisted reaction types  
- `lib/social-economy/reputation-levels.ts` — level table  
- `lib/ads/pi-ads-adapter.ts` — capability + verify scaffold (gated)  
