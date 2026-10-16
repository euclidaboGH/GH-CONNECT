# Section audit + daily claim timer (2026-10-16)

## Daily claim (critical fix)
**Weakness:** Green Claim CTA could remain after server already paid/idempotent 409; no countdown.
**Fix:**
- `markDailyClaimedForUi` aligns local day key after server success (no ledger credit)
- `msUntilNextLagosMidnight` + live HH:MM:SS countdown (Africa/Lagos)
- Feed card: muted "Daily reward claimed · Next claim in …"
- Journey: "Claimed today" + timer (not green Claim)
- Sheet: claimed panel with timer; green only when `canClaimToday`

## Feed / timeline
| Weakness | Fix / recommendation |
|----------|----------------------|
| Feed/profile engagement drift | Shared `posts[]` + engagement events (prior) |
| Rank failure blank | Unranked fallback retained |
| Demo lecture under posts | Stripped |

## Profile
| Weakness | Fix / recommendation |
|----------|----------------------|
| Comments navigated away | In-place CommentSheet |
| Own posts different chrome | OwnPostCard → EnhancedPostCard |

## Post / comment / curation
| Weakness | Fix / recommendation |
|----------|----------------------|
| Counts not syncing | engagement.comments = list length on add/delete |
| Votes local only | socialSetCuration + broadcast |

## Wallet
| Weakness | Fix / recommendation |
|----------|----------------------|
| $ vs GHC | ₲ symbol |
| Pending vs available confusion | Labels + holds strip |

## Membership
| Weakness | Fix / recommendation |
|----------|----------------------|
| Status lag after pay | Poll + visibility refresh (Phase 6) |

## Production notes
- Server daily API remains authority for GHC credit
- Timer is UX only; does not invent rewards
- Hard-refresh after deploy so local streak storage + new code align
