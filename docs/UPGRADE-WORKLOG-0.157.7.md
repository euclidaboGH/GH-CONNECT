# GreenHaven v0.157.7 — Phase 8 wallet and financial UX hardening

## Source baseline

- Built from `GREENHAVEN-0.157.6-PHASE7-SOCIAL-PRIVACY-HARDENING-2026-10-28.zip`.
- No live Supabase, Pi Network, Vercel, or production environment was accessed or modified.

## Audit findings and changes

- Wallet snapshot normalization previously accepted a missing/blank `userId`, which weakened observability of account-switch and wrong-snapshot defects. It now requires a non-empty user ID bounded to 160 characters.
- `pendingCount` previously accepted fractional numeric values and silently truncated them. It now requires a safe integer.
- Snapshot timestamps now reject values more than five minutes in the future, while retaining millisecond epoch timestamps produced by the authoritative wallet RPC.
- `holds.escrowRail` now accepts only the documented rails (`not_configured`, `ghc_ledger`, `pi_escrow`) rather than arbitrary server payload strings.
- The wallet summary API now consistently sends explicit no-store/no-cache headers for successful responses and authentication, configuration, and authoritative-read failures.
- Expanded Phase 8 source-contract checks from 15 to 20. Phase 9 transaction contracts also pass.
- Synchronized package, lockfile, app release constant, README, project truth, manifest, and Phase 1–12 acceptance report to v0.157.7.

## Financial invariants preserved

- GHC balances remain derived from the server-authoritative GHC ledger; no client-side financial mutation was added.
- Pi payment history and reconciliation remain restricted to authenticated, user-scoped `provider === "pi"` and `currency === "PI"` records.
- Refresh sequencing and stale-server-snapshot awareness remain intact.
- No migrations, live database writes, provider calls, or production settings were changed.

## Verification boundaries

Source checks do not establish live financial correctness. Supported Node.js 24.15.0 dependency installation, TypeScript, lint, production build, browser/device journeys, authenticated multi-account refresh-race tests, actual Supabase schema/RLS verification, and Pi Testnet lifecycle verification remain required before release.
