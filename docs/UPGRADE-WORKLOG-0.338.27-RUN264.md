# GREENHAVEN Run 264 — Pi authentication and wallet-consent reliability

## Changes

1. Pi Browser is detected from its user-agent before `window.Pi` is initialized. This is a UX/runtime-selection hint only; it never authenticates a user or grants payment authority.
2. Initial authentication uses the shared Pi SDK initializer instead of a second competing script loader.
3. The initial auth UI timeout no longer tells Pi Browser users that Pi Browser is missing while the bridge/server handshake is still pending.
4. Wallet consent sends the fresh Pi access token for server verification even if the SDK response omits `wallet_address`. A valid wallet address returned by the authenticated Pi Platform `/v2/me` response may be used. If both sources return an address, they must match. If neither returns a valid address, authorization remains blocked.
5. The consent checkbox is 24px with a full-width minimum 48px clickable row and visible keyboard focus styling.
6. Regression tests cover platform-address fallback, missing-both-sources fail-closed behavior, mismatch rejection, Pi Browser detection, and the mobile consent target.

## Safety and release gates

- No wallet address is user-entered, guessed or substituted.
- No browser flag or client UID is trusted for authentication.
- No withdrawal, payout, reservation, balance, ledger, or live Supabase row is modified.
- The Testnet wallet-address migration remains unapplied until the source is deployed and migration history is reconciled. Mainnet remains untouched.
- Focused source tests are not proof of live Pi Browser device acceptance or a successful Pi transfer.
