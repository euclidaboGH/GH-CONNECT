# GreenHaven 0.330.46 — Phase 11.2.5 Push Secret and Privacy Hardening

Date: 2026-11-08  
Status: **Source hardening completed; sender, worker, database deployment and real delivery remain disabled. Production is not approved.**

## Scope completed

- Corrected the remote-push SQL proposal so endpoint, `p256dh`, and `auth` values are stored as application-encrypted ciphertext, not plaintext.
- Added AES-256-GCM encryption/decryption with a 12-byte random nonce, authentication tag, versioned envelope and purpose-specific additional authenticated data.
- Subscription registration now encrypts all three sensitive values before the service-role RPC call. The endpoint SHA-256 digest remains the unique lookup key and is not sufficient to reconstruct the endpoint.
- The outbox claim RPC returns ciphertext only. Decryption is restricted to the trusted server worker boundary; no browser API receives subscription secrets.
- Replaced title/body/deep-link delivery content in the proposal with a generic payload. The service worker displays generic notification copy and always opens the app root; private message, wallet, payment, reward and membership content must be fetched after authenticated app open.
- Added cryptographic VAPID validation: public key must be a 65-byte uncompressed P-256 point, private key a 32-byte scalar, and the public point must match the point derived from the private scalar. Subject must be a valid `mailto:` contact or HTTPS URI.
- Added a trusted-terminal-only key generation script: `npm run push:generate-keys`. It prints a VAPID keypair and independent AES-256 encryption key; it does not write secrets into source files. The operator must replace the subject placeholder with a real monitored contact URI.
- Added focused source and runtime tests for ciphertext round trips, tamper rejection, VAPID keypair match/mismatch and invalid subjects.

## Required deployment variables

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY` (server-only)
- `WEB_PUSH_VAPID_SUBJECT`
- `WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY` (server-only, independent 32-byte base64url key)

The VAPID keypair and encryption key must be generated in a trusted operator terminal and entered directly into Vercel's encrypted environment settings. Do not paste private values into ChatGPT, source files, CI logs, or public environment variables. Key rotation requires an explicit versioned migration/re-encryption plan; do not replace the encryption key on existing rows without one.

## Still blocked / not claimed

- The vetted `web-push` sender package is not installed: this environment cannot reach the npm registry and has no cached package. No handwritten Web Push encryption or VAPID signing was substituted.
- No scheduled worker is activated. It would be unsafe to claim jobs while the vetted sender adapter is absent.
- The SQL remains a proposal outside `supabase/migrations`; no disposable PostgreSQL, Testnet or Mainnet execution occurred. The live database history and schema must be independently reconciled first.
- The proposal records provider HTTP status and sanitized outcomes. An `accepted` state means the push service accepted the request; it does not claim that a browser displayed it. No real provider receipts, delivery failures, retries or 404/410 endpoint responses have been observed.
- No actual Android/Pi Browser, desktop browser, offline-device, permission-revocation or multi-account device acceptance occurred.
- Remote registration and delivery remain disabled. The config endpoint does not report readiness. Production remains NOT APPROVED.

## Verification

- `scripts/check-phase1125-push-secrets.mjs`: 12/12 source contracts.
- `scripts/test-phase1125-push-secrets.mjs`: 3/3 focused runtime test groups.
- Existing Phase 11.2.4 tests remain required.
- Full project `npm run verify:static` passed (exit code 0). Node 24.15.0 dependency-backed typecheck/lint/build and complete browser/device acceptance have not been certified in this Node 22.16.0, dependency-free environment.
