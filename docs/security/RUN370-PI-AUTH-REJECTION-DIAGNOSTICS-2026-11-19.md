# RUN370 — Pi authentication rejection diagnostics

Date: 2026-11-19
Base source: user-provided RUN369 archive, GreenHaven 0.338.99
Scope: Pi Testnet/Sandbox authentication diagnostics only.

## Evidence reviewed

The supplied Pi Browser report showed:
- `mode=sandbox`, `sandbox=true`;
- `hasWindowPi=true`, `hasInit=true`, `hasAuthenticate=true`, `initialized=true`;
- `inIframe=true`, `referrerHost=sandbox.minepi.com`, `sandboxFrame=true`;
- `userActivationActive=true` at the moment `Pi.authenticate` was invoked;
- repeated SDK rejection within approximately 0.4–0.7 seconds, with `Error: Authentication failed.`

The Developer Portal screenshots showed the app registered as Pi Testnet, Testnet visibility Public, Pi Sign-In Active, PiNet Active, and the expected Vercel Development URL. The user confirmed Sandbox authorization was completed.

These facts establish that SDK loading/initialization and the app's local Sandbox frame detection are working. They do not establish why Pi's authorization service rejects the request. The `/api/auth/pi` server identity verification route is not reached when `Pi.authenticate` rejects before returning an access token.

## Changes

`lib/pi-runtime.ts` now extracts a small, allow-listed set of rejection metadata from the SDK error:
- bounded uppercase machine error code, if supplied;
- bounded HTTP-like status, if supplied;
- allow-listed error field names, not their values;
- sanitized, bounded reason text, preferring machine-readable code/reason fields over a generic message.

Nested metadata inspection is limited to one level (`data`, `response`, `cause`). Raw errors, response bodies, access tokens, usernames, Pi UIDs, cookies, and request bodies are not serialized. The existing single-flight behavior, 25-second timeout, username-only scope, direct user gesture, and mandatory server-side `/v2/me` verification remain unchanged.

Added `scripts/check-run370-pi-auth-rejection-metadata.mjs` and registered it in both `prebuild:checks` and `verify:static`.

## Verification

- RUN370 safe metadata contract: 7/7 PASS.
- RUN344 Pi auth diagnostics UX: 10/10 PASS.
- RUN343 Pi auth timeout: 8/8 PASS.
- Full `npm run verify:static`: exit 0.

## Limitations / next evidence required

This patch improves the next diagnostic report; it does not claim to fix or explain the Pi-side rejection. The updated code must be deployed to the Testnet preview and exercised in Pi Browser. Then copy the new token-free diagnostics. If Pi supplies a machine code or status in the rejection object, RUN370 will expose only that bounded metadata. If it still supplies only the generic message, the app cannot infer the Pi platform's internal rejection reason from client-side evidence; the operator should escalate the timestamp, app slug, environment, and sanitized report through Pi developer support.

No Developer Portal settings were changed. No API keys were changed. No OAuth fallback, local identity fallback, token bypass, or server-verification bypass was introduced. No Supabase migration, GitHub push, Vercel deployment, or Mainnet operation was performed. GreenHaven remains Testnet-only; production remains NOT APPROVED.
