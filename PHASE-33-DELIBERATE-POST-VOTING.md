# Phase 33 — Deliberate Post Voting and Reaction Safety

## User-facing behavior
- A normal tap on either upvote/downvote control opens the compact reaction picker; it does not submit a curation vote.
- A continuous 1.2-second hold submits the chosen curation vote through the existing authenticated API. Releasing early, pointer cancellation, or moving off the button cancels a pending vote.
- Reaction picker no longer opens from holding the post media; this removes a source of unexpected reaction UI on both Feed and Profile, which share `EnhancedPostCard`.
- Reaction icons are compact (`h-8`, `text-base`) rather than oversized.

## Economy and security
- No client-side GHC balance deduction was added. Any redistribution/reward remains based on the existing server response and server feature gates.
- The 100% curation weight selector remains explicit; users must deliberately hold to submit a vote.
- Vote API authorization, balance funding, durable ledger, and idempotency remain server-side responsibilities.

## Validation
- `scripts/check-deliberate-post-voting.mjs`: 7/7 pass.
- Registered static verification: 16/16 pass.
- Project truth: 10/10 pass.
- Release hygiene: 11/11 pass.
- Production safety scan: 21 pass, 0 fail.
- Dependency lock integrity passed.
- Full typecheck and production build were not run in this environment; runtime target remains Node.js 24.15.0 or newer. Real-device and authenticated Testnet checks remain required.
