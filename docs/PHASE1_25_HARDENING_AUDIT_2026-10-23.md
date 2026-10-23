# Phase 1 → 25 Hardening Audit (0.71.0)

## Scope

Static production-readiness audit of the continuous GreenHaven modernization program (Phases 1–25) plus later phase artifacts already present in tree (26–44 reports).

## Architecture invariants confirmed

- **Server authority**: social writes go through service-role `socialRpc` with `Content-Profile: public`.
- **Phase 39 policy**: no silent historical RPC overload fallbacks (missing signature → `SOCIAL_RPC_UNAVAILABLE`).
- **Self-curation forbidden**: own-post upvote/downvote rejected.
- **Comment identity**: `authorId` from session only.
- **Demo policy**: `isDemoDataAllowed()` false in production unless explicit studio flags.
- **Post-sync**: versioned `ghc:post-sync` for edit/archive/restore/delete/upsert/engagement.
- **Engagement bus**: `ghc:post-engagement` for cross-surface count propagation.

## Hardening applied in 0.71.0

1. `socialSetCuration` success path now emits **both** `broadcastPostSync(engagement)` and `broadcastPostEngagement(curation)` so Feed/Profile/Search stay coherent after durable votes.
2. Social write contract tests updated for Phase 39 (no silent fallback expectation).
3. New `npm run audit:phase1-25-hardening` static invariant suite.

## Weaknesses still requiring operator / live work (not claimed fixed)

| Area | Status |
|------|--------|
| Live Supabase RPC signatures (6-arg with_reward) | Operator must confirm + `NOTIFY pgrst` |
| Pi Testnet E2E payments/membership | Phase 42 |
| npm vulnerability surface (stellar/eslint/dompurify) | Phase 41 hygiene |
| Full `next build` on this package in CI | Must pass on Vercel after push |
| Community demo seeds | Gated by demo policy; keep flags off in production |

## Remaining roadmap (unchanged)

Phases 26–44 as previously defined; current tree already contains reports through Phase 44. Continue with production build green + live social/economy verification before Mainnet claims.
