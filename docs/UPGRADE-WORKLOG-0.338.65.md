# Run #302 — Pi withdrawal authorization and diagnostics hardening (0.338.65)

Date: 2026-11-13  
Baseline: `GREENHAVEN-0.338.64-RUN301-RELEASE-GATE-CI-FIXES.zip`

## Twenty targeted upgrades

1. Wallet addresses used for A2U consent must come from the server-verified Pi Platform `/v2/me` response.
2. The Pi SDK address returned by the browser is treated only as an equality check, never as a server-side proof or fallback.
3. Missing wallet addresses and browser-only, unverified addresses now return distinct safe error codes.
4. Pi app UIDs are trimmed and length-bounded before identity checks.
5. The forward identity mapping must belong to the authenticated GreenHaven user.
6. The reverse mapping must point to the same GreenHaven account.
7. The reverse mapping must also echo the exact verified Pi UID.
8. Durable identity ownership is resolved before evaluating wallet-address proof, improving the accuracy of mismatch diagnostics.
9. Pi public-key format is validated server-side before any grant RPC.
10. The grant service accepts only `platform_api` wallet provenance.
11. Grant user IDs and Pi UIDs are validated and bounded before privileged database calls.
12. Grant RPC results must echo the exact Pi UID, wallet address and provenance requested.
13. Authorization status is active only for a valid public key with server-verified `platform_api` or `provider_payment` provenance.
14. Authorization status additionally requires a non-null Platform verification timestamp.
15. Legacy UID-only and SDK-only rows remain inactive and expose a machine-readable remediation reason.
16. The GET route no longer turns unexpected store failures into a successful authorization-status response.
17. The grant route preserves an allowlist of safe database business-error codes instead of collapsing every business conflict into a generic save error.
18. Grant-failure logs now include a bounded stage and Vercel/request correlation ID without logging access tokens or wallet addresses.
19. The post-grant read-back independently requires the exact UID, address, Platform source and verification timestamp.
20. Client consent is single-flight across mounted components, status/grant requests have finite timeouts, error-code normalization rejects inherited object keys, and the Wallet card explains how to repair legacy consent.

## Verification

- Run #302 source contract: 27/27 passed.
- Phase 28 wallet-consent runtime tests: 14/14 passed.
- Phase 28 wallet-consent source contract: 46/46 passed.
- Run #260 Pi wallet/A2U diagnostics: 25/25 passed.
- Phase 2 wallet authorization: 27/27 passed.
- Phase 7 Pi identity/withdrawal: 10/10 passed.
- Run #246 withdrawal/recovery reliability: 18/18 passed.
- Run #256 A2U review queue: 13/13 passed.
- Phase 4 withdrawal boundary: 12/12 passed.
- Phase 6 withdrawal fee: 8/8 passed.
- Wallet Phase 4 journey: 11/11 passed.
- Wallet Phase 5 release gate: 19/19 passed.
- Run #291 payout release safety: 15/15 passed.
- Run #297 stale-hold reaper contract: PASS.

These are source-level, source-only verification checks and static/runtime contracts. They do not prove a successful Pi Browser permission grant, live Pi A2U transfer, funded Testnet app wallet, provider receipt, or end-to-end withdrawal.

## Connected Testnet observations (read-only)

- One active Pi wallet authorization exists without a wallet address or wallet-address source. It is intentionally not considered active by the hardened application contract.
- Thirteen historical earnings payout requests are currently `released`; none has a persisted provider payment ID or provider txid.
- One A2U review-queue item remains open with reason `UNCERTAIN_EARNINGS_PAYOUT_NO_PROVIDER_ID`. It was not changed. Do not release, retry, settle or close it without authoritative Pi provider reconciliation.
- No active execution-lane lease or provider-sequence lease was present at the time of inspection; the A2U execution ledger contained zero rows.
- Testnet migration `20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics` is recorded as applied. No migration was applied by Run #302.

## Limits and release status

The supplied Vercel request trace was not available from the connected observability API, so the exact branch that produced the historical HTTP 409 cannot be proven retrospectively. The route now preserves safe business error codes and emits stage/correlation diagnostics for the next attempt. No database rows, balances, reservations, provider payments, GitHub branches or Vercel deployments were mutated by this source repair. The available workspace runtime is Node.js 22.16.0, below the repository-required Node.js 24.15.0. The prebuild runner stops at its Node-version gate. An offline `npm ci` could not complete because `zod@3.25.67` was not present in the local npm cache; online installation timed out. Dependency-backed typecheck, lint and production build therefore remain unverified. Production remains **NOT APPROVED**.
