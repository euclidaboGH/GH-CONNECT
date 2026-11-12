# GreenHaven 0.283.0 — Video audit gap-fill (post Phases 1–5)

Date: 2026-11-03

## Why

Re-reviewed the original Preview video recommendations against 0.282.0. Phases 1–5 closed trust-breakers; this package closes remaining polish gaps that still showed in source.

## Implemented

### Discovery
- Grammar: “1 person” / “N people”
- Online filter only when candidates carry server presence flags; otherwise “Presence offline” + toast
- Self still excluded via meId + graph excludes
- Connection card: Connect/Message primary; Like secondary styling; LazyImage avatars
- Action order: connect → like → pass; matched: message → connect → like

### Wallet
- Payment methods Pi rail no longer says “membership & packs” (membership stays on Membership screen)

## Still backlog (not claimed done)
- Admin pending join approval queue UI depth
- Pull-to-refresh gesture on all tabs (soft-refresh exists; native PTR not universal)
- Mixed-rail single checkout server support
- Full Playwright multi-user proof on Testnet
- Message thread photo enrichment when API omits participantPhoto

## Verification
`node scripts/check-phase5b-video-gapfill.mjs`
