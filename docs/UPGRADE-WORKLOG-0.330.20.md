# GREENHAVEN 0.330.20 — Phase 2 Wallet product transformation

Date: 2026-11-07
Baseline: 0.330.19

## Audited foundations retained

The existing Wallet already contains independent GHC and Pi rails, server-confirmed read snapshots, PIN-protected GHC withdrawal, fresh Pi consent, idempotent withdrawal intents, server-side reward claims, read-only payment reconciliation, bounded request lifecycles and stale-snapshot handling. The upgrade deliberately reuses these systems rather than creating parallel balance or payment flows.

## Implemented

- Explicitly presents GHC available, pending, locked and escrow-locked amounts on the GHC rail; Pi available, withdrawable, pending and reserved amounts remain separately sourced on the Pi rail.
- Makes balance visibility a browser-session preference only, avoiding a persistent cross-session preference on shared devices.
- Adds a pure statement-summary helper over the currently loaded and filtered GHC rows. Incoming/outgoing settled movement is separated from pending amounts; failed, reversed, cancelled and expired rows are excluded from settled totals.
- Discloses the current 80-row local GHC hydration ceiling and explicitly avoids claiming a complete lifetime statement. No cursor API was invented.
- Changes Wallet Read refresh to return an explicit boolean confirmation result. Manual refresh awaits the latest server read and advances the successful-sync timestamp only on confirmed success. Existing latest-request-wins cancellation and last-server-snapshot preservation remain intact.
- Adds a dedicated Phase 2 static contract and registers it in prebuild and static verification.

## Preserved boundaries

No database migration, client-side balance authority, transfer, mint, payout, refund, reward issuance, Pi/GHC conversion, checkout completion or settlement behavior was added. Existing API/RPC, RLS, service-role, PIN proof, Pi consent, idempotency, durable rate limit and provider boundaries remain authoritative.

## Verification and remaining gates

The new Phase 2 source-only contract and existing Wallet source contracts are run locally. Node.js 24.15.0 typecheck/lint/build, browser/device/Pi Browser, real Supabase schema/RLS, multi-user privacy, Pi Testnet and operator acceptance remain outstanding. Production remains NOT APPROVED.
