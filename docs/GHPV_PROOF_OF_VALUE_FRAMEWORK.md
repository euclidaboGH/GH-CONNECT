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


## Implementation status (repository, 2026-10-06)

| Area | Status |
|------|--------|
| GHPV-0 doctrine | IMPLEMENTED IN CODE (docs) |
| GHPV-1A active weights | IMPLEMENTED IN CODE / TESTED LOCALLY |
| GHPV-1B settlement service | IMPLEMENTED IN CODE / TESTED LOCALLY (static) |
| Live Testnet settlement | REQUIRES TESTNET VALIDATION |
| Production worker/cron | REQUIRES PRODUCTION DEPLOYMENT — not deployed |
| Feed ranking from CQI | Not built |
| Vote → GHC | Forbidden / not implemented |

### Economic firewall

```text
Social curation  →  GHPV quality/calibration
GHC ledger       →  separate; settlement RPCs do not call ghc_execute_*
```

RAW CURATION POWER is the reviewer's stored unit weight.
SETTLEMENT CONSENSUS SHARE is capped at 12% only inside consensus calculation.
Majority is not ground truth: low confidence, close races, and creative/opinion modes can remain UNRESOLVED.

JCS bounds: 0–100. Per-event delta capped at 2.5. Daily absolute delta capped at 6. Unresolved judgments do not apply adverse JCS deltas.

## Settlement invocation

Settlement is a system operation. `POST /api/social/posts/[id]/ghpv/settle` requires `GH_SETTLEMENT_INTERNAL_KEY` and header `x-gh-settlement-key`. If the key is unset the route returns 503. No production cron is configured.

Calibration bounds are enforced in `20261018_ghpv_calibration_bounds.sql`: JCS 0–100, per-event delta ±2.5, unresolved/protected delta forced to 0.

Quality status values in `gh_content_quality_state.settlement_status`: open, pending, settled, unresolved, quarantined.
