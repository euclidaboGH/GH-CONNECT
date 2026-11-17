# Run #284 — Discovery, Relationships, Messaging & Calling: 30-Point Upgrade Register

**Baseline:** user-uploaded GreenHaven 0.338.47 / Run #283.  
**Current derivative:** 0.338.49 / Run #284.  
**Status:** partial implementation; do not read planned or verified items as new code delivered by this run.

| # | Upgrade target | Status |
|---:|---|---|
| 1 | Suppress legacy/root-level Discovery opt-out and hidden/private profile settings at response projection | IMPLEMENTED |
| 2 | Filter match inbox by blocks in either direction | IMPLEMENTED |
| 3 | Respect hidden/no-one/matches-only profile privacy in match inbox | IMPLEMENTED |
| 4 | Fail closed if block/privacy reads fail or truncate | IMPLEMENTED |
| 5 | Keep Discovery search and keyset cursor bounded | EXISTING — regression checked |
| 6 | Keep durable Discovery RPC as source of matches-only eligibility | EXISTING — live RPC verified; source migration missing |
| 7 | Restore exact live Discovery RPC migration source and reconcile opt-out JSON paths | OPEN — migration-source prerequisite |
| 8 | Add server-owned match inbox RPC to consolidate block/privacy filtering | OPEN — requires reconciled migration |
| 9 | Keep match writes session-derived, pair-locked and block-aware | EXISTING — live RPC verified |
| 10 | Make mutual-match detection and notifications idempotent across retries | OPEN — inspect event dedupe and write acknowledgement |
| 11 | Keep Follow actor session-derived and server-throttled | EXISTING — regression checked |
| 12 | Verify Follow `whoCanFollow` privacy against persisted settings | OPEN — DB/source contract review |
| 13 | Keep Connect requests actor-bound, bounded and rate-limited | EXISTING — source reviewed |
| 14 | Verify connection accept/reject/block pair serialization against exact live SQL | OPEN — applied SQL source missing |
| 15 | Prevent duplicate direct-message POST after successful domain send | IMPLEMENTED |
| 16 | Preserve one stable idempotency key across retries and offline flush | EXISTING — regression checked |
| 17 | Verify conversation creation always uses canonical atomic direct-message RPC | EXISTING — live migration present, exact source missing |
| 18 | Add durable message reaction persistence and APIs | OPEN |
| 19 | Reconcile message edit/delete/pin/read receipt state across devices | OPEN — full two-account acceptance required |
| 20 | Keep attachment IDs owner-verified and reject arbitrary remote URLs | EXISTING — source regression checked |
| 21 | Keep server-side full-history search scoped to conversation membership | EXISTING — regression checked |
| 22 | Add robust per-conversation offline retry fencing and visible failure/retry state | OPEN |
| 23 | Verify archive/mute/pin preferences persist and hydrate across devices | OPEN — API/UI integration test required |
| 24 | Keep call creation and transitions tied to authenticated conversation membership | EXISTING — live RPC verified |
| 25 | Keep WebRTC offer/answer/ICE server-authorized, bounded and block-aware | EXISTING — live RPC verified |
| 26 | Keep calls fail-closed until TURN and operator enablement are configured | EXISTING — source reviewed; provider acceptance open |
| 27 | Verify call history indexes and retention cleanup against exact migration source | OPEN — Run #284 live migration source absent |
| 28 | Complete thread header, compact header, footer hide/restore and scroll/focus acceptance | OPEN — device/browser acceptance |
| 29 | Reconcile 39 live Testnet migrations with the 220-file local source manifest | OPEN — only 10 exact source filenames found |
| 30 | Stabilize Vercel build command/cache cleanup and align GitHub source baseline | PARTIAL — Vercel setting updated; GitHub testnet remains 0.338.31 |

## Run #284 evidence

- Discovery privacy fallback: 6/6.
- Match inbox privacy tests: 10/10.
- Match inbox wiring: 9/9.
- Single-owner message write: 5/5.
- Combined Run #284 focused assertions: 30/30.
- Full static verification: 3,619 PASS, 0 FAIL.

Open items are intentionally not marked complete. No new Supabase migration was applied because the source archive does not contain exact SQL for 29 of the 39 applied Testnet migration records. Mainnet was not accessed.
