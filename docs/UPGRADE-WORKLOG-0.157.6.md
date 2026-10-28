# GreenHaven v0.157.6 — Phase 7 social privacy hardening

## Source baseline

- Built from the authoritative `GREENHAVEN-0.157.5-PHASE6-APP-SHELL-NAVIGATION-2026-10-28.zip` source tree.
- No live Supabase, Pi Network, or Vercel environment was accessed or modified.

## Audit findings and changes

- The feed already failed closed when canonical visibility or the durable mute lookup was unavailable.
- The feed previously retained rows with no usable `authorId`/`author_id` because `!authorId` evaluated to `true`; such rows could not be checked against the viewer's mute list.
- Feed handling now returns `503 FEED_AUTHOR_ID_UNAVAILABLE` when any row lacks the canonical author identifier. This is intentionally fail-closed and no-store; malformed feed payloads are not returned to the client.
- Added Phase 7 assertions for this contract and registered `check-phase7-social-experience.mjs` in consolidated static verification.
- Updated package, lockfile, app release constant, verified manifest, README, project truth, and Phase 1–12 consolidated report to `0.157.6`.

## Verification boundaries

- Source-level tests do not establish live database, browser, or provider behavior.
- Supported Node.js 24.15.0 installation, TypeScript, lint, production build, multi-account feed/mute journeys, oversized story requests, and live Testnet acceptance remain required before release.
