# Run #302 — Pi withdrawal authorization hardening

**Source version:** `0.338.65`  
**Scope:** Pi wallet consent, authorization status, payout assertions and actionable diagnostics.

The key correction is that a browser-supplied `walletAddress` is not proof of wallet ownership. The server now requires the Pi Platform API to independently return the wallet address for the freshly verified Pi access token. A value returned by the Pi SDK in the browser can only be compared with that server response; it can never be used as a fallback. Pi's current SDK documentation identifies `wallet_address` as an authentication scope, and Pi's server verification guidance identifies `/v2/me` as the backend source of truth. See [Pi SDK reference](https://developers.minepi.com/docs/api-reference/SdkReference) and [Pi Sign-in guide](https://github.com/pi-apps/pi-platform-docs/blob/master/pi-sign-in.md).

A legacy authorization that has only a Pi UID, an SDK-only address, or an address without a trusted server verification timestamp remains inactive. After the provider independently confirms an exact A2U `to_address`, the database marks that destination `provider_payment`; this is also trusted provenance for subsequent withdrawals. The user must grant fresh consent in Pi Browser after the registered GreenHaven app has `wallet_address` permission enabled. The user must never type or paste a wallet destination.

The worker still requires a fresh payout authorization before request execution, validates the exact Pi UID and amount, checks the provider `to_address`, independently reads the provider receipt, and settles only after transaction verification and developer completion. Uncertain provider outcomes remain reserved for authoritative reconciliation; no blind replacement payment is created.

See `docs/UPGRADE-WORKLOG-0.338.65.md` for the 20 changes, tests and connected Testnet findings. No database migration is introduced by this run.

**Release boundary:** Preview/Testnet source candidate only. A fresh Node 24.15.0 dependency-backed typecheck/lint/build, a real Pi Browser re-consent, a controlled small-value Testnet payout and independent provider receipt verification are still required. Mainnet and production remain NOT APPROVED.
