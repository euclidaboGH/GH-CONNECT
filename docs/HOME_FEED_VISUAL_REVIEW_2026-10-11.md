# Home / Feed visual review (2026-10-11)

## Honest assessment

**Is the Home/Feed designed as it should be?**

**Mostly yes for production quality** — not a pixel clone of marketing posters.

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Card shape / radius / shadow | Strong | `1.25rem` + `--gh-card-shadow` |
| Green system | Strong | Upvote emerald, CTAs `--gh-green` |
| Hierarchy (author → content → actions) | Strong after polish | Clear header, body, toolbar |
| Spacing rhythm | Strong | List `space-y-3.5`, intentional padding |
| Media presentation | Improved | Muted surface, softer radius |
| Engagement clarity | Strong | Curation primary; like secondary quieter |
| Marketing poster fidelity | N/A | Not the goal (no fake metrics/backgrounds) |

## Fixes applied this pass

- Avatar / online / verified chrome
- Media placeholder tokens (no gray-100 gradient)
- Link preview card language
- Content typography tracking/leading
- Primary action bar padding
- Secondary like row de-emphasized (curation stays primary)
- Home greeting + create board spacing
- Feed list vertical rhythm

## Remaining intentional limits

- Dual engagement (upvote + like) is product behavior, not a visual bug
- Empty feed depends on real network data
- Stories/header density constrained by real feature set

## Files

- `components/ghc/enhanced-post-card.tsx`
- `components/ghc/home-command-centre.tsx`
- `components/ghc/enhanced-feed-screen.tsx`
