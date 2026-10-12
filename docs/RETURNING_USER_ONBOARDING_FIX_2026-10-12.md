# Returning user onboarding loop fix (2026-10-12)

## Problem
Users who already registered were forced through profile registration again on return (PIN unlock, Pi re-auth, cold start).

## Root causes
1. Non-durable / lagging `onboardingCompleted` on identity mapping set `needsOnboarding=true`.
2. Pi identity handler set `profile.onboarded = false` when server said required, wiping local completion.
3. Server profile hydrate treated `onboarded: false` as authoritative even when device stamp proved completion.
4. Local stamp matching failed when Pi UID vs GH user id aliases differed.

## Fixes
- Broaden device onboarding stamp recognition (`ghc.profile` + stamp).
- UI gate: local stamp / completed local profile wins over flaky server `required`.
- Never clear `onboarded` when stamp or completed local profile exists.
- Boot hydrate from `ghc.profile` before Pi finishes.
- Server profile hydrate preserves local onboarded when stamp present.
- Pi `/api/auth/pi` heals `onboardingCompleted` when a server profile has a display name.

## Operator
Ensure durable `gh_pi_identities` + profile store so flags survive deploys. Local stamp is a device safety net, not a substitute for durable identity in production.
