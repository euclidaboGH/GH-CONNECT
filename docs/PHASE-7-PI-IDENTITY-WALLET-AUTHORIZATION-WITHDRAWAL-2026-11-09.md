# Phase 7 — Pi Identity, Wallet Authorization and Withdrawal Boundaries

**Date:** 2026-11-09  
**Source baseline:** `gh-connect@0.338.13`  
**Status:** Partially complete; external Testnet and Mainnet verification outstanding.

## Confirmed source issue and bounded fix

The generic `resolveAuthenticatedUser` fallback verified a Pi access token against the Pi Platform `/v2/me` endpoint, then initialized the GreenHaven user ID to the Pi UID and replaced it only if a mapping lookup succeeded. When the mapping was missing or unavailable, production could therefore treat an app-specific Pi UID as a canonical GH user ID. These identifiers are distinct namespaces.

The resolver now fails closed in production if the verified Pi UID has no canonical `gh_pi_identities` mapping. The legacy raw-UID fallback remains only for non-production compatibility. Existing GH HttpOnly-session authentication is unchanged, and the `/api/auth/pi` bootstrap remains responsible for creating the durable mapping before issuing a session.

## Reviewed safeguards retained

- Pi tokens are verified server-side through `/v2/me`; client-supplied user IDs are not accepted as identity proof.
- Production Pi bootstrap requires durable identity and session stores.
- Wallet authorization requires explicit consent and fresh Pi proof tied to the authenticated GH session's mapped Pi UID.
- Earnings payout execution verifies the stored recipient and wallet authorization before provider-side payment creation.
- Payout execution remains Testnet-only and guarded by explicit feature flags and server credentials.
- Uncertain provider outcomes retain reservations for recovery; the patch does not automatically release funds or execute payments.

## Source checks

The new `scripts/check-phase7-pi-identity-withdrawal.mjs` has 10 source-contract checks and is registered in `prebuild` and `verify:static`. Targeted existing wallet authorization, identity integration, payout lifecycle, execution worker, settlement recovery and receipt-fencing checks should also be run as part of the phase verification.

Source checks cannot establish provider connectivity, Supabase migration state, live wallet consent, actual Pi transaction status, or production environment configuration.

## Outstanding gates

1. Run the Node 24.15.x toolchain with dependencies installed; full typecheck, lint and production build are not asserted by this report.
2. Test mapped, unmapped, stale, revoked and unavailable identity mappings in isolated auth tests.
3. Verify actual Testnet `gh_pi_identities`, `gh_sessions` and wallet-authorization migration history using read-only evidence.
4. Run the official Pi Testnet A2U end-to-end flow only after environment flags, provider credentials, recipient mapping, consent and recovery behavior have been independently confirmed.
5. Reconcile Mainnet separately; no Testnet evidence authorizes Mainnet execution.

No migrations were added or applied. No wallet balances, payout records, provider transactions, secrets or remote database settings were changed. Package version remains `0.338.13`.
