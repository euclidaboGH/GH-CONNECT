# RUN344 — Pi sign-in diagnostics and sandbox launch hint
Date: 2026-11-18
Baseline: GREENHAVEN-0_338_99-RUN343-PI-AUTH-RETRY-REPAIR-1.zip (package gh-connect 0.338.99, version unchanged)

## Finding
The Pi Browser screen shows `Authentication failed. (PI_AUTHENTICATE_FAILED)`. That string is not produced by this repository; it is the Pi SDK's own rejection of `Pi.authenticate`, returned quickly (not a hang), and it happens before `/api/auth/pi` is called. Existing diagnostics recorded only the error *name*, so the SDK's actual reason was discarded.

No ecosystem or Field Research code calls the Pi SDK; those modules cannot directly cause this rejection.

## Changes (client only; no server, schema, env, dependency or payment change)
- `lib/pi-runtime.ts`: sanitized (<=80 chars, printable, token-redacted) SDK rejection reason, a bounded reason class (e.g. GENERIC_SDK_REJECTION, SCOPE_REJECTED, ORIGIN_NOT_REGISTERED), error shape and framing flag in the token-free diagnostic; non-Error rejections are wrapped so the message is kept; bounded in-memory history and `buildPiAuthDiagnosticReport()`; `getPiSandboxLaunchHint()`.
- `contexts/pi-auth-context.tsx`: when sandbox mode is on, the page is not framed by Pi's sandbox, and authenticate fails, the error message adds a hint to open the app from Pi Develop's Sandbox link.
- `components/auth-loading-screen.tsx`: "Copy sign-in diagnostics" button (report also shown on screen if the clipboard is blocked).
- `scripts/check-run344-pi-auth-diagnostics-ux.mjs` (10 checks), wired into `verify:static` and `prebuild:checks`.

## Not proven
This does not prove the cause. Live Pi Browser testing is still required: use the Sandbox link, confirm the registered Development URL matches the deployed origin, and send the copied diagnostics if it still fails.
