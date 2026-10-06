# GREENHAVEN PROOF-OF-VALUE FRAMEWORK (GHPV)

**Status:** GHPV-0 frozen product law (source)  
**Product:** GreenHaven / GH-CONNECT  
**Doctrine:** Create value → meaningful judgment → trust → reach → support → earn from real value.

## Non-negotiable rules

1. GHC balance does **not** grant vote weight or curation power.
2. A vote is **not** a GHC minting event.
3. Tips move money; votes move judgment and distribution signals.
4. Scores are **server-calculated only**; clients never submit authoritative quality/reputation numbers.
5. One downvote never instantly destroys reputation.
6. Majority is not automatically “truth”; confidence and independence matter.
7. Creator monetization eligibility requires trust; rank cannot be purchased.
8. Quality pools (if any) are funded only from approved real revenue—not inflation from engagement.
9. Financial mutations remain on the **GHC ledger** only (existing economy RPCs).
10. Preserve existing 15 public levels (Seed → Legend) and Haven gate (level 7).

## Five internal scores (never one financial mega-score)

| Score | Meaning | GHC balance affects? |
|-------|---------|----------------------|
| CQS — Creator Quality | Content quality outcomes | No |
| JCS — Judgment Calibration | Accuracy of curation over time | No |
| CIS — Community Integrity | Constructive independent behaviour | No |
| EVS — Economic Value | Real tips/commerce support | No (EVS *describes* support; balance ≠ power) |
| Growth XP | Long-term progression | No |

Public surface remains the **15-level** badge; internals may be richer.

## Rails

- **Rail A — Signal:** `gh_post_curations` (upvote / downvote / neutral)
- **Rail B — Trust:** `gh_reputation_*` + future calibration/integrity dimensions
- **Rail C — Money:** `gh_tip_intents` → authoritative ledger settle (GHC/Pi)

## Phased delivery

| Phase | Scope | GHC? |
|-------|--------|------|
| GHPV-0 | This specification | No |
| GHPV-1 | Judgment infrastructure tables + server modules | No |
| GHPV-2 | Curation Power from level + JCS + integrity | No |
| GHPV-3 | Feed ranking integration | No |
| GHPV-4 | Multi-dimension reputation state | No |
| GHPV-5 | Tip ledger settlement | Yes (ledger only) |
| GHPV-6 | Creator Quality Pool from real revenue | Yes (program only) |
| GHPV-7 | Stewardship roles | No (privileges) |

## Related existing docs

- `docs/GH_SOCIAL_ECONOMY.md`
- `docs/GH_CURATION.md`
- `docs/GH_REPUTATION.md`
- `docs/GH_ATTENTION.md`

