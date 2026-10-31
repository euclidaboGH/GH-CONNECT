# Post, Curation & Conversation — 3-Phase Production Upgrade

## Phase 1 — Post surface and curation UX
- Feed and Profile continue to share `EnhancedPostCard`, preventing behavior drift.
- Primary engagement controls now use production-size touch targets and calmer hierarchy.
- Curation is framed as a quality signal; vote weight does not imply GHC issuance.
- Community Board curation uses the same quality language and organized action toolbar.
- Reward/insight disclosure remains server-authoritative and progressive rather than crowding the post body.

## Phase 2 — Comments, replies and reactions
- Comment ranking defaults to Top, with Newest available for chronological reading.
- Top ranking prioritizes pinned discussion, then reaction/reply participation, then recency.
- Reply context stays explicit in the composer and can be cancelled without losing the draft.
- Existing nested threads, media, edit/delete ownership, reporting and quick reactions are retained.

## Phase 3 — Production hardening
- Social client requests without a caller signal now have a 12-second timeout.
- Post reaction, comment reaction and curation mutation bodies use the shared hard bounded JSON reader.
- Oversized engagement payloads return 413; malformed bodies fail closed with 400.
- Existing auth, rate limits, visibility checks, durable RPCs and server-authoritative reward decisions remain intact.

## Verification
- `node scripts/check-phase-post-curation-production.mjs` — 12/12 PASS
- `npm run verify:static` — PASS
- Local TypeScript/build not claimed: workspace Node is v22.16.0 while the project correctly requires Node ^24.15.0. Vercel/CI Node 24 remains the compiler gate.
